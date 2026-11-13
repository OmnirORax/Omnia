import {createPulseBandSampler,referencePulse,PULSE_FFT_SIZE,type PulseKey} from './pulse.ts';
import type {SceneVfx} from './vfx.ts';
import {shouldStartSystemAudio,readSystemAudioPreference,saveSystemAudioPreference,pauseRememberedSystemAudio,forgetSystemAudioPreference,validPairingCode} from './systemAudioPreference.ts';
import {pcmWorkletSource,systemAudioOriginSupported,systemAudioRequiresPairing} from './nativePcm.ts';
import {createNativeAudioTransport} from './nativeAudioTransport.ts';
import {createAudioResponse,createAudioMeasurement,RESPONSE_HZ} from './audioResponse.ts';
/** Live PCM is ephemeral; remembered connection credentials stay device-local. */
let context:AudioContext|null=null,source:AudioNode|null=null,splitter:ChannelSplitterNode|null=null;
let analysers:AnalyserNode[]=[];
const response=createAudioResponse(),measure=createAudioMeasurement(),timeSamples=[new Float32Array(PULSE_FFT_SIZE),new Float32Array(PULSE_FFT_SIZE)],samples=timeSamples.map(buffer=>buffer.subarray(PULSE_FFT_SIZE-512));
const spectra=[new Uint8Array(PULSE_FFT_SIZE/2),new Uint8Array(PULSE_FFT_SIZE/2)];
let pulseSettings:Pick<SceneVfx,PulseKey>|undefined,lightEnabled=false,sampleBands:ReturnType<typeof createPulseBandSampler>|undefined;
let responseTimer:ReturnType<typeof setInterval>|undefined;
export const readSceneAudioResponse=()=>response.read(performance.now()/1000);
export const configureSceneAudioResponse=(settings:SceneVfx)=>{pulseSettings=settings;lightEnabled=settings.audioResponse.lightMax>0;response.configure(settings.audioResponse);};
function stopResponse(){if(responseTimer!==undefined)clearInterval(responseTimer);responseTimer=undefined;response.reset();}
function startResponse(){
 if(responseTimer!==undefined||!connected||!context||context.state!=='running'||document.hidden)return;
 responseTimer=setInterval(()=>{
  if(analysers.length!==2||!context||context.state!=='running')return;
  const now=performance.now()/1000;if(!response.due(now))return;
  for(let channel=0;channel<2;channel++)analysers[channel].getFloatTimeDomainData(timeSamples[channel]);
  const measured=measure(samples,context.sampleRate);let light=0;
  if(lightEnabled&&pulseSettings&&sampleBands){
   for(let channel=0;channel<2;channel++)analysers[channel].getByteFrequencyData(spectra[channel]);
   const s=pulseSettings;light=referencePulse(sampleBands(spectra),s.pulseFrequencyMin,s.pulseFrequencyMax,s.pulseAudioLow,s.pulseAudioHigh,s.pulseExponent,s.pulseAmount);
  }
  response.sample(measured.rms,now,measured.pattern,light);
 },1000/RESPONSE_HZ);
}
let cleanupNative:(()=>void)|undefined;
type InputKind='system'|null;
let inputKind:InputKind=null;
let epoch=0,status='No audio connected',connected=false;
let snapshot:{status:string;kind:InputKind;remembered:boolean}={status,kind:inputKind,remembered:false};
const listeners=new Set<()=>void>();
const publish=(message:string)=>{status=message;snapshot={status,kind:inputKind,remembered:!!readSystemAudioPreference()};listeners.forEach(fn=>fn());};
export const isSceneAudioConnected=()=>connected;
export const sceneAudioStatus=()=>status;
export const sceneAudioSnapshot=()=>snapshot;
export const subscribeSceneAudio=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export function disconnectSceneAudio(){
 stopResponse();epoch++;cleanupNative?.();cleanupNative=undefined;inputKind=null;connected=false;source?.disconnect();source=null;splitter?.disconnect();splitter=null;for(const node of analysers)node.disconnect();analysers=[];sampleBands=undefined;
 if(context)void context.close().catch(()=>{});context=null;publish('No audio connected');
}
function analysis(ctx:AudioContext){context=ctx;
 ctx.addEventListener('statechange',()=>{
  if(context!==ctx||!connected)return;
  if(ctx.state==='running'){startResponse();publish('System audio connected');}
  else{stopResponse();publish('Audio suspended — click to resume');}
 });
 sampleBands=createPulseBandSampler(ctx.sampleRate);
 splitter=ctx.createChannelSplitter(2);analysers=[ctx.createAnalyser(),ctx.createAnalyser()];
 for(let channel=0;channel<2;channel++){const node=analysers[channel];node.fftSize=PULSE_FFT_SIZE;node.smoothingTimeConstant=.7;node.minDecibels=-100;node.maxDecibels=-30;splitter.connect(node,channel);}
 return splitter;
}
export async function connectSceneSystemAudio(code=readSystemAudioPreference()?.code??''){
 if(!systemAudioOriginSupported(window.location.origin))throw Error('Use the Omnium preview, omnium.nexus or localhost to connect system audio.');
 const pairingCode=systemAudioRequiresPairing(window.location.origin)?code.trim():'';
 if(systemAudioRequiresPairing(window.location.origin)&&!validPairingCode(pairingCode))throw Error('Paste the 32-character Preview pairing code from the new Omnium Audio Helper window.');
 disconnectSceneAudio();const token=epoch;inputKind='system';publish('Connecting to Omnium Audio Helper…');
 const ctx=new AudioContext({latencyHint:'interactive'});context=ctx;
 let moduleURL='';
 try{
  if(ctx.state==='suspended')publish('Click anywhere in Omnium to resume remembered system audio');
  await ctx.resume(); // A remembered launch may need the next browser user gesture.
  if(token!==epoch)return;
  if(!ctx.audioWorklet||typeof AudioWorkletNode==='undefined')throw Error('System audio needs a browser with AudioWorklet support.');
  moduleURL=URL.createObjectURL(new Blob([pcmWorkletSource()],{type:'text/javascript'}));
  await ctx.audioWorklet.addModule(moduleURL);if(token!==epoch)return;
  const node=new AudioWorkletNode(ctx,'omnium-system-pcm',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});source=node;
  const mute=ctx.createGain();mute.gain.value=0;node.connect(analysis(ctx));for(const node of analysers)node.connect(mute);mute.connect(ctx.destination);
  let suspended=true;
  const sink={postMessage:(message:unknown,transfer:Transferable[]=[])=>{
   // A suspended worklet doesn't drain its MessagePort. Never enqueue minutes
   // of PCM there; resume with a fresh queue and the current capture only.
   if(ctx.state!=='running'){suspended=true;return;}
   if(suspended){node.port.postMessage({clear:true});suspended=false;}
   node.port.postMessage(message,transfer);
  }};
  const transport=createNativeAudioTransport(sink,(ready,message)=>{
   if(token!==epoch)return;
   if(connected!==ready){stopResponse();}
   connected=ready;if(ready)startResponse();publish(message);
  },pairingCode,()=>{if(token===epoch)saveSystemAudioPreference(pairingCode,true);});
  cleanupNative=()=>{transport.stop();node.port.close();mute.disconnect();};
 }catch(error){if(token!==epoch)return;disconnectSceneAudio();publish(error instanceof Error?error.message:'System audio connection failed');throw error;}
 finally{if(moduleURL)URL.revokeObjectURL(moduleURL);}
}

/** Install once at the app boundary, independent of opening the settings panel. */
export function startRememberedSystemAudio(){
 const resume=()=>{
  if(inputKind==='system'&&context?.state==='suspended')void context.resume().catch(()=>{});
 };
 const visibility=()=>{if(document.hidden)stopResponse();else startResponse();};
 document.addEventListener('visibilitychange',visibility);
 window.addEventListener('pointerdown',resume,true);window.addEventListener('keydown',resume,true);
 if(shouldStartSystemAudio(window.location.origin)){
  void connectSceneSystemAudio().catch(error=>publish(error instanceof Error?error.message:'System audio reconnect failed'));
 }
 return()=>{document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pointerdown',resume,true);window.removeEventListener('keydown',resume,true);};
}
export function forgetSceneSystemAudio(){
 disconnectSceneAudio();forgetSystemAudioPreference();publish('System audio forgotten — pair once to remember it again');
}

/** Toggle connection intent, including a pending connection or reconnect. */
export async function toggleSceneSystemAudio(code=readSystemAudioPreference()?.code??''){
 if(inputKind==='system'){stopSceneAudio();return;}
 await connectSceneSystemAudio(code);
}

export function stopSceneAudio(){
 pauseRememberedSystemAudio();
 disconnectSceneAudio();
}
export function disposeSceneAudio(){ disconnectSceneAudio(); }
