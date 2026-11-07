import {PULSE_CONTROLS} from './pulse.ts';
import {defineFunction} from '../properties/function.ts';
import type {WorkspaceSettings} from '../workspaceActions';
import {DEFAULT_SCENE_VFX, SCENE_LIGHT_CONTROLS, MIN_SCENE_VFX_FPS, MAX_SCENE_VFX_FPS, type SceneVfx} from './vfx.ts';
const category={id:'scene',label:'Scene'};
const write=(settings:WorkspaceSettings,key:keyof SceneVfx,value:string|number|boolean)=>({...settings,sceneVfx:{...settings.sceneVfx,[key]:value}});
export default defineFunction<WorkspaceSettings>({
 id:'scene.vfx',label:'Scene effects',owner:'settings',group:[category],controls:['scene.vfx.lightModel','scene.vfx.pulseTintLow','scene.vfx.pulseTintHigh',...PULSE_CONTROLS.map(c=>`scene.vfx.${c.key}`),'scene.vfx.color','scene.vfx.allColors','scene.vfx.bounce','scene.vfx.waves','scene.vfx.distortion','scene.vfx.glitching','scene.vfx.maxFps',...SCENE_LIGHT_CONTROLS.map(({key})=>`scene.vfx.${key}`)],inputs:{
 'scene.lightModel':{definition:{id:'scene.lightModel',label:'Light model',kind:'select',initial:'pulse',options:[{id:'pulse',label:'Wallpaper Engine pulse'},{id:'legacy',label:'Earlier approximation'}],category},read:s=>s.sceneVfx.lightModel,write:(s,v)=>write(s,'lightModel',v)},
 ...Object.fromEntries(['pulseTintLow','pulseTintHigh'].map(key=>[`scene.${key}`,{
 definition:{id:`scene.${key}`,label:key==='pulseTintLow'?'Low tint':'High tint',kind:'color' as const,channelOf:'color',initial:key==='pulseTintLow'?'#a8a8a8':'#ffffff',category},read:(s:WorkspaceSettings)=>s.sceneVfx[key as 'pulseTintLow'|'pulseTintHigh'],write:(s:WorkspaceSettings,v:string|number|boolean)=>write(s,key as 'pulseTintLow'|'pulseTintHigh',v)}])),
 ...Object.fromEntries(PULSE_CONTROLS.map(({key,label,initial,min,max,step,integer})=>[`scene.${key}`,{
 definition:{id:`scene.${key}`,label,kind:'number' as const,min,max,step,integer,initial,category},read:(s:WorkspaceSettings)=>s.sceneVfx[key],write:(s:WorkspaceSettings,v:string|number|boolean)=>write(s,key,v)}])),
 ...Object.fromEntries(SCENE_LIGHT_CONTROLS.map(({key,label,initial,min,max,step})=>[`scene.${key}`,{
   definition:{id:`scene.${key}`,label,kind:'number' as const,min,max,step,initial,category},
   read:(s:WorkspaceSettings)=>s.sceneVfx[key],write:(s:WorkspaceSettings,v:string|number|boolean)=>write(s,key,v),
 }])),
 color:{initial:DEFAULT_SCENE_VFX.audioLight,read:s=>s.sceneVfx.audioLight,write:(s,v)=>write(s,'audioLight',v)},
 'scene.lightAllColors':{definition:{id:'scene.lightAllColors',label:'All colours',kind:'toggle',initial:false,category},read:s=>s.sceneVfx.lightAllColors,write:(s,v)=>write(s,'lightAllColors',v)},
 'scene.audioBounce':{definition:{id:'scene.audioBounce',label:'Audio Bounce',kind:'number',min:1,max:1.5,step:.01,initial:1.12,category},read:s=>s.sceneVfx.audioBounce,write:(s,v)=>write(s,'audioBounce',v)},
 'scene.waves':{definition:{id:'scene.waves',label:'Waves',kind:'toggle',initial:true,category},read:s=>s.sceneVfx.waves,write:(s,v)=>write(s,'waves',v)},
 'scene.distortion':{definition:{id:'scene.distortion',label:'Distortion',kind:'number',min:0,max:1,step:.01,initial:.4,category},read:s=>s.sceneVfx.distortion,write:(s,v)=>write(s,'distortion',v)},
 'scene.maxFps':{definition:{id:'scene.maxFps',label:'Max FPS',kind:'number',min:MIN_SCENE_VFX_FPS,max:MAX_SCENE_VFX_FPS,step:1,integer:true,initial:DEFAULT_SCENE_VFX.maxFps,category},read:s=>s.sceneVfx.maxFps,write:(s,v)=>write(s,'maxFps',v)},
 'scene.glitching':{definition:{id:'scene.glitching',label:'Glitching',kind:'number',min:0,max:1,step:.01,initial:.3,category},read:s=>s.sceneVfx.glitching,write:(s,v)=>write(s,'glitching',v)},
 }});
