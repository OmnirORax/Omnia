import {normalizeAudioLevel} from './vfx.ts';
/** Ephemeral, explicitly connected browser audio. Nothing here is persisted. */
let context:AudioContext|null=null,analyser:AnalyserNode|null=null,source:AudioNode|null=null,stream:MediaStream|null=null;
let activeMedia:HTMLMediaElement|null=null;
let cleanupMedia:(()=>void)|undefined;
let bytes=new Uint8Array(0),epoch=0,status='No audio connected',connected=false;
let player:HTMLAudioElement|null=null,playerURL='';
let snapshot:{status:string;player:HTMLAudioElement|null}={status,player};
const listeners=new Set<()=>void>();
const publish=(message:string)=>{status=message;snapshot={status,player};listeners.forEach(fn=>fn());};
const contextRunning=()=>context?.state==='running';
export const isSceneAudioConnected=()=>connected;
export const sceneAudioStatus=()=>status;
export const sceneAudioSnapshot=()=>snapshot;
export const subscribeSceneAudio=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export function disconnectSceneAudio(){
 epoch++;activeMedia?.pause();activeMedia=null;cleanupMedia?.();cleanupMedia=undefined;connected=false;source?.disconnect();source=null;analyser?.disconnect();analyser=null;
 stream?.getTracks().forEach(t=>t.stop());stream=null;
 if(context)void context.close().catch(()=>{});context=null;bytes=new Uint8Array(0);publish('No audio connected');
}
function analysis(ctx:AudioContext){context=ctx;
 ctx.addEventListener?.('statechange',()=>{if(context!==ctx||!connected)return;if(ctx.state==='suspended')publish('Audio suspended — press Play or Connect shared audio to resume');else if(ctx.state==='running')publish(stream?'Shared audio connected':'Audio file connected');});analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.7;bytes=new Uint8Array(analyser.frequencyBinCount);return analyser;}
export async function connectSharedSceneAudio(){
 if(stream&&connected&&context?.state==='suspended'){const token=epoch;await context.resume();if(token===epoch)publish(contextRunning()?'Shared audio connected':'Audio is suspended — click Connect shared audio to resume');return;}
 stopSceneAudio();const token=epoch;
 if(!navigator.mediaDevices?.getDisplayMedia)throw Error('Audio sharing is unavailable in this browser. Use an audio file instead.');
 const ctx=new AudioContext();context=ctx;void ctx.resume().catch(()=>{if(token===epoch)publish('Audio is suspended — click Connect shared audio to resume');});publish('Choose a tab or screen and enable audio sharing');
 try{
 const captured=await navigator.mediaDevices.getDisplayMedia({audio:true,video:true});
 if(token!==epoch){captured.getTracks().forEach(t=>t.stop());void ctx.close().catch(()=>{});return;}
 stream=captured;
 if(!captured.getAudioTracks().length)throw Error('No audio was shared. Choose a source with audio and enable its Share audio option.');
 source=ctx.createMediaStreamSource(new MediaStream(captured.getAudioTracks()));source.connect(analysis(ctx));connected=true;
 for(const track of captured.getTracks())track.addEventListener('ended',()=>{if(token===epoch)disconnectSceneAudio();},{once:true});
 publish('Shared audio connected');
 }catch(error){if(token===epoch){disconnectSceneAudio();publish(error instanceof Error?error.message:'Audio sharing failed');}throw error;}
}
export async function connectSceneAudioElement(element:HTMLMediaElement){
 if(activeMedia===element&&connected&&context){void context.resume().catch(()=>publish('Press Play to enable browser audio'));return;}
 disconnectSceneAudio();const token=epoch;const ctx=new AudioContext();context=ctx;
 try{source=ctx.createMediaElementSource(element);source.connect(analysis(ctx));analyser!.connect(ctx.destination);
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
export function stopSceneAudio(){
 disconnectSceneAudio();player?.pause();
 if(playerURL)player=filePlayer(playerURL); // A closed WebAudio source cannot reuse its media element.
 publish('No audio connected');
}
export function disposeSceneAudio(){
 disconnectSceneAudio();player?.pause();player=null;if(playerURL)URL.revokeObjectURL(playerURL);playerURL='';publish('No audio connected');
}
