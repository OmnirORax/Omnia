import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {CoupledField,type PropertyBindings} from '../properties/CoupledProperties';
import {UISection} from '../ui/UISection';
import {UIField} from '../ui/UIField';
import {FunctionControl} from '../ui/UIWorkspace';
import {useFeatureActions} from '../ui/useFeatureActions';
import {connectSharedSceneAudio,connectSceneAudioElement,disconnectSceneAudio,sceneAudioStatus,subscribeSceneAudio} from './audio';
export function SceneVfxControls({bindings}:{bindings:PropertyBindings}){
 const file=useRef<HTMLInputElement>(null),player=useRef<HTMLAudioElement>(null),[url,setURL]=useState(''),[playerVersion,setPlayerVersion]=useState(0),[error,setError]=useState('');
 const status=useSyncExternalStore(subscribeSceneAudio,sceneAudioStatus);
 useEffect(()=>()=>{disconnectSceneAudio();},[]);
 useEffect(()=>{if(!url)return;return()=>URL.revokeObjectURL(url);},[url]);
 const fail=(error:unknown)=>setError(error instanceof Error?error.message:'Audio connection failed');
 useFeatureActions('sceneAudio',{
 'scene.audioConnect':{enabled:true,run:()=>{player.current?.pause();setPlayerVersion(v=>v+1);setError('');void connectSharedSceneAudio().catch(fail);}},
 'scene.audioDisconnect':{enabled:true,run:()=>{player.current?.pause();setPlayerVersion(v=>v+1);disconnectSceneAudio();setError('');}},
 'scene.audioFile':{enabled:true,run:()=>file.current?.click()},
 });
 return <UISection id="scene-vfx" title="Scene effects">
 {([['color','Audio Light','color'],['scene.audioBounce','Audio Bounce','bounce'],['scene.waves','Waves','waves'],['scene.distortion','Distortion','distortion'],['scene.glitching','Glitching','glitching']] as const).map(([property,label,key])=><UIField key={key} id={`scene.vfx.${key}`} label={label} category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property={property} label={label}/></UIField>)}
 <FunctionControl id="scene.audioConnect"/><FunctionControl id="scene.audioFile"/><FunctionControl id="scene.audioDisconnect"/>
 <input ref={file} type="file" accept="audio/*" hidden onChange={event=>{const selected=event.target.files?.[0];event.target.value='';if(!selected)return;player.current?.pause();disconnectSceneAudio();setError('');setURL(URL.createObjectURL(selected));}}/>
 {url&&<audio key={`${url}:${playerVersion}`} ref={player} src={url} controls onPointerDown={event=>{void connectSceneAudioElement(event.currentTarget).catch(fail);}} onKeyDown={event=>{void connectSceneAudioElement(event.currentTarget).catch(fail);}} onPlay={event=>{setError('');void connectSceneAudioElement(event.currentTarget).catch(fail);}}/>}
 <small role="status">{error||status}</small>
 <small>Share a tab with audio, or play a local file. Screen/system audio support depends on your browser. Closing this panel disconnects audio.</small>
 </UISection>;
}
