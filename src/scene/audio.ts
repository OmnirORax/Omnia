import {referencePulse,createAutomaticPulse} from './pulse.ts';
import type {SceneVfx} from './vfx.ts';
import {normalizeAudioLevel} from './vfx.ts';
/** Ephemeral, explicitly connected browser audio. Nothing here is persisted. */
let context:AudioContext|null=null,analyser:AnalyserNode|null=null,source:AudioNode|null=null;
let splitter:ChannelSplitterNode|null=null,stereo:AnalyserNode[]=[];
const automaticPulse=createAutomaticPulse();let fftMode='',pulseResponse=0,bounceResponse=0;
export const scenePulseResponse=()=>pulseResponse;
export const sceneBounceResponse=()=>bounceResponse;
const spectrumBytes=[new Uint8Array(1024),new Uint8Array(1024)],bands=new Float32Array(32);
let activeMedia:HTMLMediaElement|null=null;
let cleanupMedia:(()=>void)|undefined;
let bytes=new Uint8Array(0),epoch=0,status='No audio connected',connected=false;
let player:HTMLAudioElement|null=null,playerURL='',parking:HTMLDivElement|null=null;
let snapshot:{status:string;player:HTMLAudioElement|null}={status,player};
const listeners=new Set<()=>void>();
const publish=(message:string)=>{status=message;snapshot={status,player};listeners.forEach(fn=>fn());};
export const isSceneAudioConnected=()=>connected;
export const sceneAudioStatus=()=>status;
export const sceneAudioSnapshot=()=>snapshot;
export const subscribeSceneAudio=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export function disconnectSceneAudio(){
 automaticPulse.reset();fftMode='';pulseResponse=bounceResponse=0;epoch++;activeMedia?.pause();activeMedia=null;cleanupMedia?.();cleanupMedia=undefined;connected=false;source?.disconnect();source=null;analyser?.disconnect();analyser=null;
 splitter?.disconnect();splitter=null;stereo.forEach(a=>a.disconnect());stereo=[];bands.fill(0);
 if(context)void context.close().catch(()=>{});context=null;bytes=new Uint8Array(0);publish('No audio connected');
}
function analysis(ctx:AudioContext){context=ctx;
 ctx.addEventListener?.('statechange',()=>{if(context!==ctx||!connected)return;if(ctx.state==='suspended')publish('Audio suspended — press Play to resume');else if(ctx.state==='running')publish('Audio file connected');});analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.7;bytes=new Uint8Array(analyser.frequencyBinCount);return analyser;}
export async function connectSceneAudioElement(element:HTMLMediaElement){
 if(activeMedia===element&&connected&&context){void context.resume().catch(()=>publish('Press Play to enable browser audio'));return;}
 disconnectSceneAudio();const token=epoch;const ctx=new AudioContext();context=ctx;
 try{source=ctx.createMediaElementSource(element);source.connect(analysis(ctx));analyser!.connect(ctx.destination);
 if(ctx.createChannelSplitter){splitter=ctx.createChannelSplitter(2);source.connect(splitter);stereo=[ctx.createAnalyser(),ctx.createAnalyser()];stereo.forEach((a,i)=>{a.fftSize=2048;a.smoothingTimeConstant=.7;splitter!.connect(a,i);});}
 const resume=()=>{if(token===epoch)void ctx.resume().catch(()=>{if(token===epoch)publish('Press Play to enable browser audio');});};
 element.addEventListener('play',resume);cleanupMedia=()=>element.removeEventListener('play',resume);
 activeMedia=element;connected=true;publish('Audio file connected');resume();}
 catch(error){if(token===epoch)disconnectSceneAudio();throw error;}
}
/** Bounded FFT sampling: bass band 1 of a log-spaced 16-band approximation. */
export function sampleSceneAudio(){
 if(!connected||!analyser||!context||context.state!=='running')return {active:false,bass:0,level:0};
 analyser.getByteFrequencyData(bytes);
 const hz=context.sampleRate/analyser.fftSize;
 const low=Math.max(1,Math.floor(31/hz)),high=Math.max(low+1,Math.ceil(65/hz));
 let bass=0,level=0;
 for(let i=low;i<Math.min(high,bytes.length);i++)bass+=bytes[i]/255;
 analyser.getByteTimeDomainData(bytes);
 for(let i=0;i<bytes.length;i++)level+=Math.pow((bytes[i]-128)/128,2);
 return {active:true,bass:bass/(high-low),level:normalizeAudioLevel(Math.sqrt(level/bytes.length))};
}


/** Manual retains 16 log bands/channel; Automatic follows frequency-local rises
 * across both channels, retaining a short analysis window rather than sustained loudness. */
export function sampleScenePulse(settings:SceneVfx,seconds=1/60){
 if(!connected||!context||context.state!=='running'||stereo.length!==2||activeMedia?.paused===true){pulseResponse=bounceResponse=0;return 0;}
 const auto=settings.pulseRangeMode==='auto';
 if(fftMode!==settings.pulseRangeMode){
  fftMode=settings.pulseRangeMode;automaticPulse.reset();
  for(const node of stereo){node.fftSize=auto?1024:2048;node.smoothingTimeConstant=auto?0:.7;node.minDecibels=-100;node.maxDecibels=auto?0:-30;}
 }
 let peak=0,onset=0,onsetLevel=0,bassOnset=0,bassLevel=0;
 const hz=context.sampleRate/(auto?1024:2048),upper=Math.min(20000,context.sampleRate/2);
 for(let channel=0;channel<2;channel++){
  const buffer=spectrumBytes[channel];stereo[channel].getByteFrequencyData(buffer);
  if(auto){
   const first=Math.max(1,Math.floor(20/hz)),last=Math.min(buffer.length,stereo[channel].frequencyBinCount,Math.ceil(upper/hz));
   const measure=automaticPulse.spectrum(buffer,channel,first,last,seconds,Math.floor(180/hz)+1);
   peak=Math.max(peak,measure.level);
   if(measure.change>onset){onset=measure.change;onsetLevel=measure.changeLevel;}
   if(measure.bassChange>bassOnset){bassOnset=measure.bassChange;bassLevel=measure.bassChangeLevel;}
   continue;
  }
  for(let band=0;band<16;band++){
   const low=Math.max(0,Math.min(buffer.length-1,Math.floor(20*Math.pow(upper/20,band/16)/hz)));
   const high=Math.max(low+1,Math.min(buffer.length,Math.ceil(20*Math.pow(upper/20,(band+1)/16)/hz)));
   let value=0;for(let i=low;i<high;i++)value+=buffer[i]/255;bands[channel*16+band]=value/(high-low);
  }
 }
 pulseResponse=auto?automaticPulse.sample(peak,seconds,settings.pulseSensitivity,settings.pulseAmount,onset,onsetLevel,settings.pulseDropContrast):referencePulse(bands,settings.pulseFrequencyMin,settings.pulseFrequencyMax,settings.pulseAudioLow,settings.pulseAudioHigh,settings.pulseExponent,settings.pulseAmount);
 // Read the shared calibrated response without advancing calibration again. Flash amount does not scale motion.
 bounceResponse=auto?automaticPulse.sample(peak,0,settings.pulseSensitivity,1,bassOnset,bassLevel,1):0;
 return pulseResponse;
}

/** The playback session belongs to the app, not to the settings panel DOM. */
function filePlayer(url:string){
 const media=new Audio(url);media.controls=true;
 const connect=()=>{if(player!==media)return;void connectSceneAudioElement(media).catch(error=>publish(error instanceof Error?error.message:'Audio connection failed'));};
 media.addEventListener('pointerdown',connect);media.addEventListener('keydown',connect);media.addEventListener('play',connect);
 media.addEventListener('error',()=>{if(player!==media)return;disconnectSceneAudio();publish('This audio file could not be decoded. Choose a supported audio file.');});
 return media;
}
export function loadSceneAudioFile(file:File){
 disconnectSceneAudio();player?.pause();if(playerURL)URL.revokeObjectURL(playerURL);
 playerURL=URL.createObjectURL(file);player=filePlayer(playerURL);publish('Audio file ready — press Play');
}
/** Playback and analysis use the same app-owned element; no browser capture. */
export async function playSceneAudio(){
 const media=player;
 if(!media){publish('Choose an audio file first');return;}
 await connectSceneAudioElement(media);
 if(player!==media)return;
 try{await media.play();if(player!==media)media.pause();}
 catch(error){if(player===media)publish(error instanceof Error?error.message:'Press Play to enable browser audio');throw error;}
}
export function stopSceneAudio(){
 disconnectSceneAudio();player?.pause();
 if(playerURL)player=filePlayer(playerURL); // A closed WebAudio source cannot reuse its media element.
 publish('No audio connected');
}
export function disposeSceneAudio(){
 disconnectSceneAudio();player?.pause();player?.remove();player=null;parking?.remove();parking=null;if(playerURL)URL.revokeObjectURL(playerURL);playerURL='';publish('No audio connected');
}

/** Keep the media element in the document while its settings view is closed.
 * Browsers can pause a playing element after it is detached, even if JS retains it. */
export function parkSceneAudioPlayer(media:HTMLAudioElement|null=player){
 if(!media)return;
 if(media!==player){media.remove();return;}
 if(!parking){parking=document.createElement('div');parking.hidden=true;parking.dataset.sceneAudioSession='';document.body.appendChild(parking);}
 parking.appendChild(media);
}
