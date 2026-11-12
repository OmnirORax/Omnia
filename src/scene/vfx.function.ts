import { AUDIO_TUNING_CONTROLS,AUDIO_TUNING_DEFAULTS } from './audioTuning.ts';
import {PULSE_CONTROLS} from './pulse.ts';
import {defineFunction} from '../properties/function.ts';
import type {WorkspaceSettings} from './bindingState.ts';
import {DEFAULT_SCENE_VFX, WAVE_CONTROLS, MIN_SCENE_VFX_FPS, MAX_SCENE_VFX_FPS, type SceneVfx} from './vfx.ts';
const category={id:'scene',label:'Scene'};
const write=(settings:WorkspaceSettings,key:keyof SceneVfx,value:string|number|boolean)=>({...settings,sceneVfx:{...settings.sceneVfx,[key]:value}});
export default defineFunction<WorkspaceSettings>({
 id:'scene.vfx',label:'Scene effects',owner:'settings',group:[category],controls:[...AUDIO_TUNING_CONTROLS.map(c=>`scene.vfx.${c.key}`),'scene.vfx.pulseInterval','scene.vfx.pulseSensitivity','scene.vfx.pulseDropContrast','scene.vfx.pulseOmniTint','scene.vfx.pulseOmniTintLow','scene.vfx.imageTintEnabled','scene.vfx.imageTint','scene.vfx.pulseColorMode','scene.vfx.pulseTintLow','scene.vfx.pulseTintHigh',...PULSE_CONTROLS.filter(c=>c.key==='pulseAmount').map(c=>`scene.vfx.${c.key}`),'scene.vfx.bounce','scene.vfx.waves',...WAVE_CONTROLS.map(c=>`scene.vfx.${c.key}`),'scene.vfx.maxFps'],inputs:{
 ...Object.fromEntries(AUDIO_TUNING_CONTROLS.map(({key,label,initial,min,max,step})=>[`scene.${key}`,{
 definition:{id:`scene.${key}`,label,kind:'number' as const,initial,min,max,step,category},
 read:(s:WorkspaceSettings)=>s.sceneVfx[key]??AUDIO_TUNING_DEFAULTS[key],write:(s:WorkspaceSettings,v:string|number|boolean)=>write(s,key,Number(v))
 }])),
 'scene.pulseInterval':{definition:{id:'scene.pulseInterval',label:'Pulse interval (ms)',kind:'number',initial:DEFAULT_SCENE_VFX.pulseInterval,min:5,max:1500,step:5,category},read:s=>s.sceneVfx.pulseInterval??DEFAULT_SCENE_VFX.pulseInterval,write:(s,v)=>write(s,'pulseInterval',v)},
 'scene.pulseDropContrast':{definition:{id:'scene.pulseDropContrast',label:'Drop contrast',kind:'number',initial:DEFAULT_SCENE_VFX.pulseDropContrast,min:1,max:4,step:.05,category},read:s=>s.sceneVfx.pulseDropContrast,write:(s,v)=>write(s,'pulseDropContrast',v)},
 'scene.pulseSensitivity':{definition:{id:'scene.pulseSensitivity',label:'Sensitivity',kind:'number',initial:DEFAULT_SCENE_VFX.pulseSensitivity,min:.25,max:8,step:.05,category},read:s=>s.sceneVfx.pulseSensitivity,write:(s,v)=>write(s,'pulseSensitivity',v)},
 'scene.imageTintEnabled':{definition:{id:'scene.imageTintEnabled',label:'Enable image tint',kind:'toggle',initial:false,category},read:s=>s.sceneVfx.imageTintEnabled,write:(s,v)=>write(s,'imageTintEnabled',v)},
 'scene.imageTint':{definition:{id:'scene.imageTint',label:'Image tint colour',kind:'color',channelOf:'color',initial:DEFAULT_SCENE_VFX.imageTint,category},read:s=>s.sceneVfx.imageTint,write:(s,v)=>write(s,'imageTint',v)},
 'scene.pulseOmniTintLow':{definition:{id:'scene.pulseOmniTintLow',label:'Low tint (Omni)',kind:'color',channelOf:'color',initial:DEFAULT_SCENE_VFX.pulseOmniTintLow,category},read:s=>s.sceneVfx.pulseOmniTintLow,write:(s,v)=>write(s,'pulseOmniTintLow',v)},
 'scene.pulseOmniTint':{definition:{id:'scene.pulseOmniTint',label:'High tint (Omni)',kind:'color',channelOf:'color',initial:DEFAULT_SCENE_VFX.pulseOmniTint,category},read:s=>s.sceneVfx.pulseOmniTint,write:(s,v)=>write(s,'pulseOmniTint',v)},
 'scene.pulseColorMode':{definition:{id:'scene.pulseColorMode',label:'Tint mode',kind:'select',initial:'tint',options:[{id:'tint',label:'Single colour'},{id:'all',label:'Omni (all colours)'}],category},read:s=>s.sceneVfx.pulseColorMode,write:(s,v)=>write(s,'pulseColorMode',v)},
 ...Object.fromEntries(['pulseTintLow','pulseTintHigh'].map(key=>[`scene.${key}`,{
 definition:{id:`scene.${key}`,label:key==='pulseTintLow'?'Low tint':'High tint',kind:'color' as const,channelOf:'color',initial:DEFAULT_SCENE_VFX[key as 'pulseTintLow'|'pulseTintHigh'],category},read:(s:WorkspaceSettings)=>s.sceneVfx[key as 'pulseTintLow'|'pulseTintHigh'],write:(s:WorkspaceSettings,v:string|number|boolean)=>write(s,key as 'pulseTintLow'|'pulseTintHigh',v)}])),
 ...Object.fromEntries(PULSE_CONTROLS.filter(c=>c.key==='pulseAmount').map(({key,label,initial,min,max,step,integer})=>[`scene.${key}`,{
 definition:{id:`scene.${key}`,label,kind:'number' as const,min,max,step,integer,initial,category},read:(s:WorkspaceSettings)=>s.sceneVfx[key],write:(s:WorkspaceSettings,v:string|number|boolean)=>write(s,key,v)}])),
 'scene.audioBounce':{definition:{id:'scene.audioBounce',label:'Audio Bounce',kind:'number',min:1,max:1.5,step:.01,initial:DEFAULT_SCENE_VFX.audioBounce,category},read:s=>s.sceneVfx.audioBounce,write:(s,v)=>write(s,'audioBounce',v)},
 'scene.waves':{definition:{id:'scene.waves',label:'Waves',kind:'toggle',initial:true,category},read:s=>s.sceneVfx.waves,write:(s,v)=>write(s,'waves',v)},
 ...Object.fromEntries(WAVE_CONTROLS.map(({key,label,initial,min,max,step})=>[`scene.${key}`,{
 definition:{id:`scene.${key}`,label,kind:'number' as const,min,max,step,initial,category},read:(s:WorkspaceSettings)=>s.sceneVfx[key],write:(s:WorkspaceSettings,v:string|number|boolean)=>write(s,key,v)}])),
 'scene.maxFps':{definition:{id:'scene.maxFps',label:'Max FPS',kind:'number',min:MIN_SCENE_VFX_FPS,max:MAX_SCENE_VFX_FPS,step:1,integer:true,initial:DEFAULT_SCENE_VFX.maxFps,category},read:s=>s.sceneVfx.maxFps,write:(s,v)=>write(s,'maxFps',v)},
 }});
