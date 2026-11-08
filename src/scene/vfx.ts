import {PULSE_CONTROLS,RETIRED_OMNI_BRIGHTNESS_CONTROLS,pulsePalette,type PulseKey,type RetiredOmniBrightnessKey} from './pulse.ts';
/** Scene effects and user-adjustable light tuning; no capture/session data. */
export const SCENE_VFX_FPS = 120;
export const MIN_SCENE_VFX_FPS = 60;
export const MAX_SCENE_VFX_FPS = 1000;
/** Retained only to round-trip retired preferences. No UI or renderer consumes these. */
export const RETIRED_LIGHT_CONTROLS = [
 {key:'lightCoreStrength',label:'Core strength',initial:8,min:0,max:8,step:.05},
 {key:'lightNearStrength',label:'Near glow strength',initial:8,min:0,max:8,step:.05},
 {key:'lightFarStrength',label:'Far glow strength',initial:1,min:0,max:8,step:.05},
 {key:'lightNearRadius',label:'Near glow radius (%)',initial:0.2,min:0,max:5,step:.05},
 {key:'lightFarRadius',label:'Far glow radius (%)',initial:0,min:0,max:10,step:.1},
 {key:'lightGain',label:'Light gain',initial:12,min:0,max:12,step:.1},
 {key:'lightMix',label:'Maximum colour mix',initial:0.12,min:0,max:1,step:.01},
 {key:'lightTintSaturation',label:'Light saturation',initial:2,min:0,max:2,step:.05},
 {key:'lightHueInner',label:'Full colour range (°)',initial:180,min:0,max:180,step:1},
 {key:'lightHueOuter',label:'Outer colour range (°)',initial:0,min:0,max:180,step:1},
 {key:'lightSourcePower',label:'Bright-source emphasis',initial:2.78,min:.25,max:8,step:.1},
 {key:'lightAudioGain',label:'Audio sensitivity',initial:8,min:0,max:8,step:.1},
 {key:'lightAudioPower',label:'Audio response curve',initial:8,min:.25,max:8,step:.1},
] as const;
export type SceneLightKey = typeof RETIRED_LIGHT_CONTROLS[number]['key'];
export type SceneVfx = { pulseRangeMode:"manual"|"auto";pulseSensitivity:number; audioLight: string; audioBounce: number; waves: boolean; distortion: number; glitching: number; maxFps: number; lightAllColors: boolean; lightModel:"pulse"|"legacy"; pulseTintLow:string; pulseTintHigh:string;pulseOmniTint:string; pulseColorMode:"tint"|"all";pulseColors:string;pulseColorWidth:number;pulseAllBrightness:number;imageTintEnabled:boolean;imageTint:string } & Record<PulseKey,number> & Record<RetiredOmniBrightnessKey,number> & Record<SceneLightKey,number>;
const LIGHT_DEFAULTS=Object.fromEntries(RETIRED_LIGHT_CONTROLS.map(({key,initial})=>[key,initial])) as Record<SceneLightKey,number>;
export const DEFAULT_SCENE_VFX: Readonly<SceneVfx> = Object.freeze({pulseRangeMode:'auto',pulseSensitivity:2,audioLight:'#aa3300',audioBounce:1.3,waves:true,distortion:.4,glitching:.3,maxFps:SCENE_VFX_FPS,lightAllColors:false,imageTintEnabled:false,imageTint:'#c20000',lightModel:'pulse',pulseTintLow:'#ffe5e5',pulseTintHigh:'#001438',pulseOmniTint:'#380000',pulseColorMode:'tint',pulseColors:'#0044ff,#ff8800',pulseColorWidth:30,pulseAllBrightness:56/255,...Object.fromEntries(PULSE_CONTROLS.map(c=>[c.key,c.initial])) as Record<PulseKey,number>,...Object.fromEntries(RETIRED_OMNI_BRIGHTNESS_CONTROLS.map(c=>[c.key,c.initial])) as Record<RetiredOmniBrightnessKey,number>,...LIGHT_DEFAULTS});
export function normalizeSceneVfx(raw: unknown): SceneVfx {
 const r=(raw&&typeof raw==='object'?raw:{}) as Partial<SceneVfx>;
 const number=(v:unknown,f:number,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):f;
 const light=Object.fromEntries(RETIRED_LIGHT_CONTROLS.map(({key,initial,min,max})=>[key,number(r[key],initial,min,max)])) as Record<SceneLightKey,number>;
 const pulse=Object.fromEntries(PULSE_CONTROLS.map(c=>[c.key,c.integer?Math.round(number(r[c.key],c.initial,c.min,c.max)):number(r[c.key],c.initial,c.min,c.max)])) as Record<PulseKey,number>;
 const brightness=Object.fromEntries(RETIRED_OMNI_BRIGHTNESS_CONTROLS.map(c=>[c.key,number(r[c.key],c.initial,c.min,c.max)])) as Record<RetiredOmniBrightnessKey,number>;
 const color=(value:unknown,fallback:string)=>typeof value==='string'&&/^#[a-f\d]{6}$/i.test(value)?value:fallback;
 return {...light,...pulse,...brightness,pulseRangeMode:r.pulseRangeMode==='auto'?'auto':(r.pulseRangeMode==='manual'||!!raw&&typeof raw==='object')?'manual':DEFAULT_SCENE_VFX.pulseRangeMode,pulseSensitivity:number(r.pulseSensitivity,2,.25,8),imageTintEnabled:typeof r.imageTintEnabled==='boolean'?r.imageTintEnabled:false,imageTint:color(r.imageTint,'#c20000'),pulseColorWidth:number(r.pulseColorWidth,30,1,180),pulseAllBrightness:number(r.pulseAllBrightness,DEFAULT_SCENE_VFX.pulseAllBrightness,0,1),lightModel:r.lightModel==='legacy'?'legacy':'pulse',pulseTintLow:color(r.pulseTintLow,DEFAULT_SCENE_VFX.pulseTintLow),pulseTintHigh:color(r.pulseTintHigh,DEFAULT_SCENE_VFX.pulseTintHigh),pulseOmniTint:color(r.pulseOmniTint,'#'+Math.round(number(r.pulseAllBrightness,DEFAULT_SCENE_VFX.pulseAllBrightness,0,1)*255).toString(16).padStart(2,'0')+'0000'),pulseColorMode:r.pulseColorMode==='all'?'all':'tint',pulseColors:typeof r.pulseColors==='string'?pulsePalette(r.pulseColors).join(','):DEFAULT_SCENE_VFX.pulseColors,lightAllColors:typeof r.lightAllColors==='boolean'?r.lightAllColors:false,audioLight:typeof r.audioLight==='string'&&/^#[a-f\d]{6}$/i.test(r.audioLight)?r.audioLight:DEFAULT_SCENE_VFX.audioLight,
 audioBounce:number(r.audioBounce,DEFAULT_SCENE_VFX.audioBounce,1,1.5),waves:typeof r.waves==='boolean'?r.waves:true,
 distortion:number(r.distortion,.4,0,1),glitching:number(r.glitching,.3,0,1),maxFps:Math.round(number(r.maxFps,SCENE_VFX_FPS,MIN_SCENE_VFX_FPS,MAX_SCENE_VFX_FPS))};
}
export function serializeSceneVfx(value:unknown) { return JSON.stringify(normalizeSceneVfx(value),null,2); }
/** Reference SceneScript smoothing, evaluated with bounded elapsed time. */
export function smoothAudio(previous:number,next:number,seconds:number) {
 return previous+(Math.max(0,Math.min(1,next))-previous)*Math.min(1,Math.max(0,Math.min(.1,seconds))*25);
}
export function audioScale(bass:number,maximum:number) { return 1+Math.max(0,Math.min(1,bass))*(maximum-1); }
/** Map audible input to the engine-style 0–1 response range before shader shaping.
 * A small noise floor keeps digital silence from pulsing; quiet music stays visible. */
export function normalizeAudioLevel(rms:number) {
 return Math.sqrt(Math.min(1,Math.max(0,rms-.002)*8));
}

/** Retain pacing phase on fast displays, discard elapsed debt after a slow frame. */
export function nextVfxDeadline(previous:number,now:number,maxFps=SCENE_VFX_FPS){
 const interval=1000/Math.max(MIN_SCENE_VFX_FPS,Math.min(MAX_SCENE_VFX_FPS,maxFps)),next=(previous||now)+interval;
 return next<now?now+interval:next;
}
