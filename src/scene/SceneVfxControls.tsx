import {WAVE_CONTROLS,WAVE_PRESETS,type WaveKey} from './vfx.ts';
import {readWavePresets,type SavedWavePreset} from './wavePresets.ts';
import type {Value} from '../appearance/model.ts';
import {preparePropertyChanges} from '../properties/registry.ts';
import {UIAction} from '../ui/UIAction';
import {PROPERTY_REGISTRY} from '../appearance/registry';
import {PULSE_CONTROLS} from './pulse';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {CoupledField,type PropertyBindings} from '../properties/CoupledProperties';
import {UISection} from '../ui/UISection';
import {readSystemAudioPreference} from './systemAudioPreference';
import {UIField} from '../ui/UIField';
import {FunctionControl} from '../ui/UIWorkspace';
import {useFeatureActions} from '../ui/useFeatureActions';
import {systemAudioRequiresPairing} from './nativePcm';
import {toggleSceneSystemAudio,forgetSceneSystemAudio,sceneAudioSnapshot,subscribeSceneAudio,sampleSceneAudio,scenePulseResponse} from './audio';
export function SceneVfxControls({bindings,customPresets,onSavePreset}:{bindings:PropertyBindings;customPresets:Record<string,Value>;onSavePreset:(waves:boolean,values:Record<WaveKey,number>)=>void}){
 const meter=useRef<HTMLMeterElement>(null),responseMeter=useRef<HTMLMeterElement>(null),[error,setError]=useState('');
 const mode=bindings.values['scene.vfx']?.[PROPERTY_REGISTRY.consumer('scene.vfx')!.channels['scene.pulseColorMode']];
 const automatic=bindings.values['scene.vfx']?.[PROPERTY_REGISTRY.consumer('scene.vfx')!.channels['scene.pulseRangeMode']]==='auto';
 const tintEnabled=bindings.values['scene.vfx']?.[PROPERTY_REGISTRY.consumer('scene.vfx')!.channels['scene.imageTintEnabled']];
 const audio=useSyncExternalStore(subscribeSceneAudio,sceneAudioSnapshot);
 const [pairingCode,setPairingCode]=useState(''),pairing=systemAudioRequiresPairing(window.location.origin);
 useEffect(()=>{let frame=0,last=0;const tick=(now:number)=>{if(now-last>=100){last=now;if(meter.current)meter.current.value=sampleSceneAudio().level;if(responseMeter.current)responseMeter.current.value=scenePulseResponse();}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[]);
 const fail=(error:unknown)=>setError(error instanceof Error?error.message:'Audio connection failed');
 const savedPresets=readWavePresets(customPresets);
 const applyWavePreset=(waves:boolean,values:Record<WaveKey,number>)=>bindings.commit([...preparePropertyChanges(PROPERTY_REGISTRY,'scene.waves',waves,['scene.vfx']),...WAVE_CONTROLS.flatMap(({key})=>preparePropertyChanges(PROPERTY_REGISTRY,`scene.${key}`,values[key],['scene.vfx']))]);
 const saveWavePreset=()=>{try{const consumer=PROPERTY_REGISTRY.consumer('scene.vfx')!, state=bindings.values['scene.vfx'];const values=Object.fromEntries(WAVE_CONTROLS.map(({key})=>[key,state[consumer.channels[`scene.${key}`]]])) as Record<WaveKey,number>;const waves=state[consumer.channels['scene.waves']];if(typeof waves!=='boolean')throw Error('Waves state is unavailable.');onSavePreset(waves,values);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not save preset');}};
 const actions=useFeatureActions('sceneAudio',{
 'scene.audioForget':{enabled:true,run:()=>{forgetSceneSystemAudio();setPairingCode('');setError('');}},
 'scene.audioSystem':{enabled:true,run:()=>{setError('');const code=pairingCode||readSystemAudioPreference()?.code||'';void toggleSceneSystemAudio(code).catch(fail);}},
 });
 return <UISection id="scene-vfx" title="Scene effects">
 <UISection id="scene-pulse" title="Wallpaper Engine pulse">
 <UIField id="scene.vfx.pulseColorMode" label="Tint mode" category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property="scene.pulseColorMode" label="Tint mode"/></UIField>
 {([{key:mode==='all'?'pulseOmniTintLow':'pulseTintLow',label:mode==='all'?'Low tint (Omni)':'Low tint (base)'},{key:mode==='all'?'pulseOmniTint':'pulseTintHigh',label:mode==='all'?'High tint (Omni)':'High tint'}]).map(({key,label})=><UIField key={key} id={`scene.vfx.${key}`} label={label} category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property={`scene.${key}`} label={label}/></UIField>)}
 {mode==='all'&&<small>Both Omni tints use saturation and brightness for every image hue; the hue strip is ignored.</small>}
 <UIField id="scene.vfx.pulseRangeMode" label="Audio response" category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property="scene.pulseRangeMode"/></UIField>
 <UIField id="scene.vfx.pulseSensitivity" label="Sensitivity" category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property="scene.pulseSensitivity"/></UIField>
 {automatic?<>
 <UIField id="scene.vfx.pulseDropContrast" label="Drop contrast" category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property="scene.pulseDropContrast"/></UIField>
 <UIField id="scene.vfx.pulseAmount" label="Flash amount" category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property="scene.pulseAmount" label="Flash amount"/></UIField>
 </>:PULSE_CONTROLS.map(({key,label})=><UIField key={key} id={`scene.vfx.${key}`} label={label} category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property={`scene.${key}`} label={label}/></UIField>)}
 <label>Light response<meter ref={responseMeter} aria-label="Light response" min={0} max={2} value={0}/></label>
 </UISection>
 <UISection id="scene-image-tint" title="Image tint" defaultExpanded={false}>
 <UIField id="scene.vfx.imageTintEnabled" label="Enable image tint" category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property="scene.imageTintEnabled" label="Enable image tint"/></UIField>
 {tintEnabled&&<UIField id="scene.vfx.imageTint" label="Image tint colour" category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property="scene.imageTint" label="Image tint colour"/></UIField>}
 </UISection>
 {([['scene.audioBounce','Audio Bounce','bounce'],['scene.maxFps','Max FPS','maxFps']] as const).map(([property,label,key])=><UIField key={key} id={`scene.vfx.${key}`} label={label} category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property={property} label={label}/></UIField>)}
 <UISection id="scene-waves" title="Waves" defaultExpanded={false}>
 <UIField id="scene.vfx.waves" label="Waves enabled" category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property="scene.waves" label="On"/></UIField>
 {WAVE_PRESETS.map((preset,index)=><UIAction key={preset.label} id={`scene.vfx.wavePreset${index+1}`} label={preset.label} category="Scene" onClick={()=>applyWavePreset(true,preset)} />)}
 <UIAction id="scene.vfx.addWavePreset" label="+ preset" category="Scene" onClick={saveWavePreset}/>
 {savedPresets.map((preset:SavedWavePreset)=><UIAction key={preset.id} id={`scene.vfx.${preset.id}`} label={preset.label} category="Scene" onClick={()=>applyWavePreset(preset.waves,preset.values)}/>)}
 {WAVE_CONTROLS.map(({key,label})=><UIField key={key} id={`scene.vfx.${key}`} label={label} category="Scene"><CoupledField bindings={bindings} consumer="scene.vfx" property={`scene.${key}`}/></UIField>)}
 <small>Displacement is a percentage of the view. Each wave count controls bands across the opposite axis. Speed 0 freezes that component; negative speed reverses it. Set both displacements to 0 for no wave deformation. Values preview live and save on release.</small>
 </UISection>
 <UIField id="scene-system-audio-toggle" label="System audio" category="Scene"><label><input type="checkbox" checked={audio.kind==='system'} onChange={()=>actions.invoke('scene.audioSystem')}/>System audio</label></UIField>
 {pairing&&!audio.remembered&&<UIField id="scene-audio-pairing" label="Preview pairing code" category="Scene"><label>Pairing code<input type="password" autoComplete="off" spellCheck={false} maxLength={32} value={pairingCode} onChange={event=>setPairingCode(event.target.value)} placeholder="Paste the helper code once"/></label></UIField>}
 {audio.remembered&&<UISection id="scene-audio-settings" title="Audio connection settings" defaultExpanded={false}>
 {pairing&&<UIField id="scene-audio-repair" label="Replace pairing code" category="Scene"><label>Replace pairing code<input type="password" autoComplete="off" spellCheck={false} maxLength={32} value={pairingCode} onChange={event=>setPairingCode(event.target.value)} placeholder="Saved — turn audio off/on to use a new code"/></label></UIField>}
 <FunctionControl id="scene.audioForget"/>
 </UISection>}
 {error&&<p role="alert">{error}</p>}
 <p role="status">{audio.status}</p>
 <label>Audio input<meter ref={meter} aria-label="Audio input" min={0} max={1} value={0}/></label>
 </UISection>;
}
