import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {CoupledField,type PropertyBindings} from '../properties/CoupledProperties';
import {SCENE_LIGHT_CONTROLS} from './vfx';
import {UISection} from '../ui/UISection';
import {UIField} from '../ui/UIField';
import {FunctionControl} from '../ui/UIWorkspace';
import {useFeatureActions} from '../ui/useFeatureActions';
import {connectSharedSceneAudio,loadSceneAudioFile,stopSceneAudio,sceneAudioSnapshot,subscribeSceneAudio,sampleSceneAudio,parkSceneAudioPlayer} from './audio';
export function SceneVfxControls({bindings}:{bindings:PropertyBindings}){
 const file=useRef<HTMLInputElement>(null),host=useRef<HTMLDivElement>(null),meter=useRef<HTMLMeterElement>(null),[error,setError]=useState('');
 const audio=useSyncExternalStore(subscribeSceneAudio,sceneAudioSnapshot);
 useLayoutEffect(()=>{
   const player=audio.player;if(!player||!host.current)return;
   host.current.appendChild(player);return()=>{parkSceneAudioPlayer(player);};
 },[audio.player]);
 useEffect(()=>{let frame=0,last=0;const tick=(now:number)=>{if(now-last>=100){last=now;if(meter.current)meter.current.value=sampleSceneAudio().level;}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[]);
 const fail=(error:unknown)=>setError(error instanceof Error?error.message:'Audio connection failed');
 useFeatureActions('sceneAudio',{
 'scene.audioConnect':{enabled:true,run:()=>{setError('');void connectSharedSceneAudio().catch(fail);}},
 'scene.audioDisconnect':{enabled:true,run:()=>{stopSceneAudio();setError('');}},
 'scene.audioFile':{enabled:true,run:()=>file.current?.click()},
 });
 return <UISection id="scene-vfx" title="Scene effects">
 {([['color','Audio Light','color'],['scene.audioBounce','Audio Bounce','bounce'],['scene.waves','Waves','waves'],['scene.distortion','Distortion','distortion'],['scene.glitching','Glitching','glitching'],['scene.maxFps','Max FPS','maxFps']] as const).map(([property,label,key])=><UIField key={key} id={`scene.vfx.${key}`} label={label} category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property={property} label={label}/></UIField>)}
 <UISection id="scene-light-tuning" title="Light tuning" defaultExpanded={false}>
 {SCENE_LIGHT_CONTROLS.map(({key,label})=><UIField key={key} id={`scene.vfx.${key}`} label={label} category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property={`scene.${key}`} label={label}/></UIField>)}
 </UISection>
 <FunctionControl id="scene.audioConnect"/><FunctionControl id="scene.audioFile"/><FunctionControl id="scene.audioDisconnect"/>
 <input ref={file} type="file" accept="audio/*" hidden onChange={event=>{const selected=event.target.files?.[0];event.target.value='';if(selected){setError('');loadSceneAudioFile(selected);}}}/>
 <div ref={host}/>
 <label>Audio input<meter ref={meter} aria-label="Audio input level" min={0} max={1} value={0}/></label>
 <small role="status">{error||audio.status}</small>
 <small>Share a source with audio, or play a local file. The input meter shows what reaches the effects. Audio continues when these controls close; Disconnect audio stops it.</small>
 </UISection>;
}
