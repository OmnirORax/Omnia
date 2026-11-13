import {LIGHT_TUNING_CONTROLS,LIGHT_RESPONSE_KEYS} from './audioTuning.ts';
import {defineFunction} from '../properties/function.ts';
import type {WorkspaceSettings} from './bindingState.ts';
import {DEFAULT_SCENE_VFX, WAVE_CONTROLS, MIN_SCENE_VFX_FPS, MAX_SCENE_VFX_FPS, type SceneVfx} from './vfx.ts';
const category={id:'scene',label:'Scene'};
const write=(settings:WorkspaceSettings,key:keyof SceneVfx,value:string|number|boolean)=>({...settings,sceneVfx:{...settings.sceneVfx,[key]:value}});
export default defineFunction<WorkspaceSettings>({
 id:'scene.vfx',label:'Scene effects',owner:'settings',group:[category],controls:[...LIGHT_RESPONSE_KEYS.map(key=>`scene.vfx.${key}`),'scene.vfx.imageTintEnabled','scene.vfx.imageTint','scene.vfx.pulseTintLow','scene.vfx.pulseTintHigh','scene.vfx.waves',...WAVE_CONTROLS.map(c=>`scene.vfx.${c.key}`),'scene.vfx.maxFps'],inputs:{
 'scene.imageTintEnabled':{definition:{id:'scene.imageTintEnabled',label:'Enable image tint',kind:'toggle',initial:false,category},read:s=>s.sceneVfx.imageTintEnabled,write:(s,v)=>write(s,'imageTintEnabled',v)},
 'scene.imageTint':{definition:{id:'scene.imageTint',label:'Image tint colour',kind:'color',channelOf:'color',initial:DEFAULT_SCENE_VFX.imageTint,category},read:s=>s.sceneVfx.imageTint,write:(s,v)=>write(s,'imageTint',v)},
 ...Object.fromEntries(['pulseTintLow','pulseTintHigh'].map(key=>[`scene.${key}`,{
 definition:{id:`scene.${key}`,label:key==='pulseTintLow'?'Low tint':'High tint',kind:'color' as const,channelOf:'color',initial:DEFAULT_SCENE_VFX[key as 'pulseTintLow'|'pulseTintHigh'],category},read:(s:WorkspaceSettings)=>s.sceneVfx[key as 'pulseTintLow'|'pulseTintHigh'],write:(s:WorkspaceSettings,v:string|number|boolean)=>write(s,key as 'pulseTintLow'|'pulseTintHigh',v)}])),
 ...Object.fromEntries([
 {key:'pulseSensitivity' as const,label:'Sensitivity',initial:DEFAULT_SCENE_VFX.pulseSensitivity,min:.25,max:8,step:.05},
 {key:'pulseDropContrast' as const,label:'Contrast',initial:DEFAULT_SCENE_VFX.pulseDropContrast,min:1,max:4,step:.05},
 ...LIGHT_TUNING_CONTROLS,
 ].map(({key,label,initial,min,max,step})=>[`scene.${key}`,{
 definition:{id:`scene.${key}`,label,kind:'number' as const,min,max,step,initial,category},read:(s:WorkspaceSettings)=>s.sceneVfx[key],write:(s:WorkspaceSettings,v:string|number|boolean)=>write(s,key,v)}])),
 'scene.waves':{definition:{id:'scene.waves',label:'Waves',kind:'toggle',initial:true,category},read:s=>s.sceneVfx.waves,write:(s,v)=>write(s,'waves',v)},
 ...Object.fromEntries(WAVE_CONTROLS.map(({key,label,initial,min,max,step})=>[`scene.${key}`,{
 definition:{id:`scene.${key}`,label,kind:'number' as const,min,max,step,initial,category},read:(s:WorkspaceSettings)=>s.sceneVfx[key],write:(s:WorkspaceSettings,v:string|number|boolean)=>write(s,key,v)}])),
 'scene.maxFps':{definition:{id:'scene.maxFps',label:'Max FPS',kind:'number',min:MIN_SCENE_VFX_FPS,max:MAX_SCENE_VFX_FPS,step:1,integer:true,initial:DEFAULT_SCENE_VFX.maxFps,category},read:s=>s.sceneVfx.maxFps,write:(s,v)=>write(s,'maxFps',v)},
 }});
