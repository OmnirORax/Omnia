import {PROPERTY_REGISTRY} from '../appearance/registry';
import {preparePropertyChanges} from '../properties/registry';
import {PULSE_CONTROLS,pulsePalette,MAX_PULSE_COLORS} from './pulse';
import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {CoupledField,type PropertyBindings} from '../properties/CoupledProperties';
import {UISection} from '../ui/UISection';
import {UIField} from '../ui/UIField';
import {FunctionControl} from '../ui/UIWorkspace';
import {useFeatureActions} from '../ui/useFeatureActions';
import {playSceneAudio,loadSceneAudioFile,stopSceneAudio,sceneAudioSnapshot,subscribeSceneAudio,sampleSceneAudio,parkSceneAudioPlayer} from './audio';
export function SceneVfxControls({bindings}:{bindings:PropertyBindings}){
 const file=useRef<HTMLInputElement>(null),host=useRef<HTMLDivElement>(null),meter=useRef<HTMLMeterElement>(null),[error,setError]=useState('');
 const values=bindings.values['scene.vfx'],channels=PROPERTY_REGISTRY.consumer('scene.vfx')!.channels;
 const mode=values[channels['scene.pulseColorMode']],highTint=String(values[channels['scene.pulseTintHigh']]).toLowerCase();
 const palette=pulsePalette(values[channels['scene.pulseColors']]);
 const setPalette=(value:string)=>bindings.commit(preparePropertyChanges(PROPERTY_REGISTRY,'scene.pulseColors',value,['scene.vfx']));
 const audio=useSyncExternalStore(subscribeSceneAudio,sceneAudioSnapshot);
 useLayoutEffect(()=>{
   const player=audio.player;if(!player||!host.current)return;
   host.current.appendChild(player);return()=>{parkSceneAudioPlayer(player);};
 },[audio.player]);
 useEffect(()=>{let frame=0,last=0;const tick=(now:number)=>{if(now-last>=100){last=now;if(meter.current)meter.current.value=sampleSceneAudio().level;}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[]);
 const fail=(error:unknown)=>setError(error instanceof Error?error.message:'Audio connection failed');
 useFeatureActions('sceneAudio',{
 'scene.pulseColorAdd':{enabled:mode==='selected'&&palette.length<MAX_PULSE_COLORS&&!palette.includes(highTint),run:()=>setPalette([...palette,highTint].join(','))},
 'scene.pulseColorClear':{enabled:mode==='selected'&&palette.length>0,run:()=>setPalette('')},
 'scene.audioConnect':{enabled:true,run:()=>{setError('');void playSceneAudio().catch(fail);}},
 'scene.audioDisconnect':{enabled:true,run:()=>{stopSceneAudio();setError('');}},
 'scene.audioFile':{enabled:true,run:()=>file.current?.click()},
 });
 return <UISection id="scene-vfx" title="Scene effects">
 <UISection id="scene-pulse" title="Wallpaper Engine pulse">
 <UIField id="scene.vfx.pulseColorMode" label="Colour activation" category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property="scene.pulseColorMode" label="Colour activation"/></UIField>
 {([{key:'pulseTintLow',label:'Low tint'},...(mode==='all'?[]:[{key:'pulseTintHigh',label:mode==='selected'?'Colour to add':'High tint'}]),...PULSE_CONTROLS.filter(c=>c.key!=='pulseColorWidth'||mode==='selected')]).map(({key,label})=><UIField key={key} id={`scene.vfx.${key}`} label={label} category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property={`scene.${key}`} label={label}/></UIField>)}
 {mode==='selected'&&<>
 <UIField id="scene.vfx.pulseColors" label="Selected colours (#hex)" category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property="scene.pulseColors" label="Selected colours (#hex)"/></UIField>
 <FunctionControl id="scene.pulseColorAdd"/><FunctionControl id="scene.pulseColorClear"/>
 </>}
 </UISection>
 {([['scene.audioBounce','Audio Bounce','bounce'],['scene.waves','Waves','waves'],['scene.distortion','Distortion','distortion'],['scene.glitching','Glitching','glitching'],['scene.maxFps','Max FPS','maxFps']] as const).map(([property,label,key])=><UIField key={key} id={`scene.vfx.${key}`} label={label} category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property={property} label={label}/></UIField>)}
 <FunctionControl id="scene.audioFile"/><FunctionControl id="scene.audioConnect"/><FunctionControl id="scene.audioDisconnect"/>
 <input ref={file} type="file" accept="audio/*" hidden onChange={event=>{const selected=event.target.files?.[0];event.target.value='';if(selected){setError('');loadSceneAudioFile(selected);}}}/>
 <div ref={host}/>
 <label>Audio input<meter ref={meter} aria-label="Audio input level" min={0} max={1} value={0}/></label>
 <small role="status">{error||audio.status}</small>
 <small>Choose an audio file and press Play. The input meter shows what reaches the effects. Audio continues when these controls close; Stop audio stops it.</small>
 </UISection>;
}
