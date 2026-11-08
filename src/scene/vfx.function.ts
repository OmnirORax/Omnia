import {PULSE_CONTROLS} from './pulse.ts';
import {defineFunction} from '../properties/function.ts';
import type {WorkspaceSettings} from '../workspaceActions';
import {DEFAULT_SCENE_VFX, MIN_SCENE_VFX_FPS, MAX_SCENE_VFX_FPS, type SceneVfx} from './vfx.ts';
const category={id:'scene',label:'Scene'};
const write=(settings:WorkspaceSettings,key:keyof SceneVfx,value:string|number|boolean)=>({...settings,sceneVfx:{...settings.sceneVfx,[key]:value}});
export default defineFunction<WorkspaceSettings>({
 id:'scene.vfx',label:'Scene effects',owner:'settings',group:[category],controls:['scene.vfx.pulseRangeMode','scene.vfx.pulseSensitivity','scene.vfx.pulseOmniTint','scene.vfx.imageTintEnabled','scene.vfx.imageTint','scene.vfx.pulseColorMode','scene.vfx.pulseTintLow','scene.vfx.pulseTintHigh',...PULSE_CONTROLS.map(c=>`scene.vfx.${c.key}`),'scene.vfx.bounce','scene.vfx.waves','scene.vfx.distortion','scene.vfx.glitching','scene.vfx.maxFps'],inputs:{
 'scene.pulseRangeMode':{definition:{id:'scene.pulseRangeMode',label:'Audio response',kind:'select',initial:DEFAULT_SCENE_VFX.pulseRangeMode,options:[{id:'auto',label:'Automatic · detailed'},{id:'manual',label:'Manual'}],category},read:s=>s.sceneVfx.pulseRangeMode,write:(s,v)=>write(s,'pulseRangeMode',v)},
 'scene.pulseSensitivity':{definition:{id:'scene.pulseSensitivity',label:'Sensitivity',kind:'number',initial:2,min:.25,max:8,step:.05,category},read:s=>s.sceneVfx.pulseSensitivity,write:(s,v)=>write(s,'pulseSensitivity',v)},
 'scene.imageTintEnabled':{definition:{id:'scene.imageTintEnabled',label:'Enable image tint',kind:'toggle',initial:false,category},read:s=>s.sceneVfx.imageTintEnabled,write:(s,v)=>write(s,'imageTintEnabled',v)},
 'scene.imageTint':{definition:{id:'scene.imageTint',label:'Image tint colour',kind:'color',channelOf:'color',initial:DEFAULT_SCENE_VFX.imageTint,category},read:s=>s.sceneVfx.imageTint,write:(s,v)=>write(s,'imageTint',v)},
 'scene.pulseOmniTint':{definition:{id:'scene.pulseOmniTint',label:'High tint (Omni)',kind:'color',channelOf:'color',initial:DEFAULT_SCENE_VFX.pulseOmniTint,category},read:s=>s.sceneVfx.pulseOmniTint,write:(s,v)=>write(s,'pulseOmniTint',v)},
 'scene.pulseColorMode':{definition:{id:'scene.pulseColorMode',label:'High tint type',kind:'select',initial:'tint',options:[{id:'tint',label:'Single colour'},{id:'all',label:'Omni (all colours)'}],category},read:s=>s.sceneVfx.pulseColorMode,write:(s,v)=>write(s,'pulseColorMode',v)},
 ...Object.fromEntries(['pulseTintLow','pulseTintHigh'].map(key=>[`scene.${key}`,{
 definition:{id:`scene.${key}`,label:key==='pulseTintLow'?'Low tint':'High tint',kind:'color' as const,channelOf:'color',initial:DEFAULT_SCENE_VFX[key as 'pulseTintLow'|'pulseTintHigh'],category},read:(s:WorkspaceSettings)=>s.sceneVfx[key as 'pulseTintLow'|'pulseTintHigh'],write:(s:WorkspaceSettings,v:string|number|boolean)=>write(s,key as 'pulseTintLow'|'pulseTintHigh',v)}])),
 ...Object.fromEntries(PULSE_CONTROLS.map(({key,label,initial,min,max,step,integer})=>[`scene.${key}`,{
 definition:{id:`scene.${key}`,label,kind:'number' as const,min,max,step,integer,initial,category},read:(s:WorkspaceSettings)=>s.sceneVfx[key],write:(s:WorkspaceSettings,v:string|number|boolean)=>write(s,key,v)}])),
 'scene.audioBounce':{definition:{id:'scene.audioBounce',label:'Audio Bounce',kind:'number',min:1,max:1.5,step:.01,initial:DEFAULT_SCENE_VFX.audioBounce,category},read:s=>s.sceneVfx.audioBounce,write:(s,v)=>write(s,'audioBounce',v)},
 'scene.waves':{definition:{id:'scene.waves',label:'Waves',kind:'toggle',initial:true,category},read:s=>s.sceneVfx.waves,write:(s,v)=>write(s,'waves',v)},
 'scene.distortion':{definition:{id:'scene.distortion',label:'Distortion',kind:'number',min:0,max:1,step:.01,initial:.4,category},read:s=>s.sceneVfx.distortion,write:(s,v)=>write(s,'distortion',v)},
 'scene.maxFps':{definition:{id:'scene.maxFps',label:'Max FPS',kind:'number',min:MIN_SCENE_VFX_FPS,max:MAX_SCENE_VFX_FPS,step:1,integer:true,initial:DEFAULT_SCENE_VFX.maxFps,category},read:s=>s.sceneVfx.maxFps,write:(s,v)=>write(s,'maxFps',v)},
 'scene.glitching':{definition:{id:'scene.glitching',label:'Glitching',kind:'number',min:0,max:1,step:.01,initial:.3,category},read:s=>s.sceneVfx.glitching,write:(s,v)=>write(s,'glitching',v)},
 }});
