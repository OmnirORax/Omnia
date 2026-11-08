import {PROPERTY_REGISTRY} from '../appearance/registry';
import {PULSE_CONTROLS} from './pulse';
import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {CoupledField,type PropertyBindings} from '../properties/CoupledProperties';
import {UISection} from '../ui/UISection';
import {UIField} from '../ui/UIField';
import {FunctionControl} from '../ui/UIWorkspace';
import {useFeatureActions} from '../ui/useFeatureActions';
import {connectSceneSystemAudio,playSceneAudio,loadSceneAudioFile,stopSceneAudio,sceneAudioSnapshot,subscribeSceneAudio,sampleSceneAudio,scenePulseResponse,parkSceneAudioPlayer} from './audio';
export function SceneVfxControls({bindings}:{bindings:PropertyBindings}){
 const file=useRef<HTMLInputElement>(null),host=useRef<HTMLDivElement>(null),meter=useRef<HTMLMeterElement>(null),responseMeter=useRef<HTMLMeterElement>(null),[error,setError]=useState('');
 const mode=bindings.values['scene.vfx']?.[PROPERTY_REGISTRY.consumer('scene.vfx')!.channels['scene.pulseColorMode']];
 const automatic=bindings.values['scene.vfx']?.[PROPERTY_REGISTRY.consumer('scene.vfx')!.channels['scene.pulseRangeMode']]==='auto';
 const tintEnabled=bindings.values['scene.vfx']?.[PROPERTY_REGISTRY.consumer('scene.vfx')!.channels['scene.imageTintEnabled']];
 const audio=useSyncExternalStore(subscribeSceneAudio,sceneAudioSnapshot);
 useLayoutEffect(()=>{
   const player=audio.player;if(!player||!host.current)return;
   host.current.appendChild(player);return()=>{parkSceneAudioPlayer(player);};
 },[audio.player]);
 useEffect(()=>{let frame=0,last=0;const tick=(now:number)=>{if(now-last>=100){last=now;if(meter.current)meter.current.value=sampleSceneAudio().level;if(responseMeter.current)responseMeter.current.value=scenePulseResponse();}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[]);
 const fail=(error:unknown)=>setError(error instanceof Error?error.message:'Audio connection failed');
 useFeatureActions('sceneAudio',{
 'scene.audioSystem':{enabled:true,run:()=>{setError('');void connectSceneSystemAudio().catch(fail);}},
 'scene.audioConnect':{enabled:true,run:()=>{setError('');void playSceneAudio().catch(fail);}},
 'scene.audioDisconnect':{enabled:true,run:()=>{stopSceneAudio();setError('');}},
 'scene.audioFile':{enabled:true,run:()=>file.current?.click()},
 });
 return <UISection id="scene-vfx" title="Scene effects">
 <UISection id="scene-pulse" title="Wallpaper Engine pulse">
 <UIField id="scene.vfx.pulseColorMode" label="Tint mode" category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property="scene.pulseColorMode" label="Tint mode"/></UIField>
 {([{key:mode==='all'?'pulseOmniTintLow':'pulseTintLow',label:mode==='all'?'Low tint (Omni)':'Low tint (base)'},{key:mode==='all'?'pulseOmniTint':'pulseTintHigh',label:mode==='all'?'High tint (Omni)':'High tint'}]).map(({key,label})=><UIField key={key} id={`scene.vfx.${key}`} label={label} category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property={`scene.${key}`} label={label}/></UIField>)}
 {mode==='all'&&<small>Both Omni tints use saturation and brightness for every image hue; the hue strip is ignored.</small>}
 <UIField id="scene.vfx.pulseRangeMode" label="Audio response" category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property="scene.pulseRangeMode"/></UIField>
 {automatic?<>
 <UIField id="scene.vfx.pulseSensitivity" label="Sensitivity" category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property="scene.pulseSensitivity"/></UIField>
 <UIField id="scene.vfx.pulseDropContrast" label="Drop contrast" category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property="scene.pulseDropContrast"/></UIField>
 <UIField id="scene.vfx.pulseAmount" label="Flash amount" category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property="scene.pulseAmount" label="Flash amount"/></UIField>
 </>:PULSE_CONTROLS.map(({key,label})=><UIField key={key} id={`scene.vfx.${key}`} label={label} category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property={`scene.${key}`} label={label}/></UIField>)}
 <label>Light response<meter ref={responseMeter} aria-label="Light response" min={0} max={2} value={0}/></label>
 </UISection>
 <UISection id="scene-image-tint" title="Image tint" defaultExpanded={false}>
 <UIField id="scene.vfx.imageTintEnabled" label="Enable image tint" category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property="scene.imageTintEnabled" label="Enable image tint"/></UIField>
 {tintEnabled&&<UIField id="scene.vfx.imageTint" label="Image tint colour" category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property="scene.imageTint" label="Image tint colour"/></UIField>}
 </UISection>
 {([['scene.audioBounce','Audio Bounce','bounce'],['scene.waves','Waves','waves'],['scene.distortion','Distortion','distortion'],['scene.glitching','Glitching','glitching'],['scene.maxFps','Max FPS','maxFps']] as const).map(([property,label,key])=><UIField key={key} id={`scene.vfx.${key}`} label={label} category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property={property} label={label}/></UIField>)}
 <FunctionControl id="scene.audioSystem"/><FunctionControl id="scene.audioFile"/><FunctionControl id="scene.audioConnect"/><FunctionControl id="scene.audioDisconnect"/>
 <input ref={file} type="file" accept="audio/*" hidden onChange={event=>{const selected=event.target.files?.[0];event.target.value='';if(selected){setError('');loadSceneAudioFile(selected);}}}/>
 <div ref={host}/>
 <label>Audio input<meter ref={meter} aria-label="Audio input level" min={0} max={1} value={0}/></label>
 <small role="status">{error||audio.status}</small>
 <small>Connect system audio with Omnium Audio Helper running, or choose a file and press Play. The input meter shows what reaches the effects. Closing controls keeps the connection; Stop audio disconnects it.</small>
 </UISection>;
}
