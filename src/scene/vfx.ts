import {PULSE_CONTROLS,RETIRED_FLARE_CONTROLS,RETIRED_OMNI_BRIGHTNESS_CONTROLS,pulsePalette,type PulseKey,type RetiredFlareKey,type RetiredOmniBrightnessKey} from './pulse.ts';
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
/** Current sine-wave approximation: exposed independently for live user tuning.
 * Displacement is percent of viewport UV span; frequency is cycles across its driving axis. */
export const WAVE_CONTROLS = [
 {key:'waveAmplitudeX',label:'Horizontal displacement (%)',initial:.1,min:0,max:5,step:.025},
 {key:'waveAmplitudeY',label:'Vertical displacement (%)',initial:.3,min:0,max:5,step:.025},
 {key:'waveFrequencyX',label:'Horizontal wave count',initial:1.5,min:0,max:40,step:.25},
 {key:'waveFrequencyY',label:'Vertical wave count',initial:10,min:0,max:40,step:.25},
 {key:'waveSpeedX',label:'Horizontal phase speed (rad/s)',initial:3,min:-20,max:20,step:.05},
 {key:'waveSpeedY',label:'Vertical phase speed (rad/s)',initial:3,min:-20,max:20,step:.05},
] as const;
export type WaveKey=typeof WAVE_CONTROLS[number]['key'];
const WAVE_DEFAULTS=Object.fromEntries(WAVE_CONTROLS.map(({key,initial})=>[key,initial])) as Record<WaveKey,number>;
export type SceneLightKey = typeof RETIRED_LIGHT_CONTROLS[number]['key'];
export type SceneVfx = { pulseRangeMode:"manual"|"auto";pulseSensitivity:number;pulseDropContrast:number; audioLight: string; audioBounce: number; waves: boolean; distortion: number; glitching: number; maxFps: number; lightAllColors: boolean; lightModel:"pulse"|"legacy"; pulseTintLow:string; pulseTintHigh:string;pulseOmniTint:string;pulseOmniTintLow:string; pulseColorMode:"tint"|"all";pulseColors:string;pulseColorWidth:number;pulseAllBrightness:number;imageTintEnabled:boolean;imageTint:string } & Record<WaveKey,number> & Record<RetiredFlareKey,number> & Record<PulseKey,number> & Record<RetiredOmniBrightnessKey,number> & Record<SceneLightKey,number>;
const LIGHT_DEFAULTS=Object.fromEntries(RETIRED_LIGHT_CONTROLS.map(({key,initial})=>[key,initial])) as Record<SceneLightKey,number>;
export const DEFAULT_SCENE_VFX: Readonly<SceneVfx> = Object.freeze({pulseRangeMode:'auto',pulseSensitivity:8,pulseDropContrast:1,audioLight:'#aa3300',audioBounce:1.3,waves:true,distortion:.4,glitching:.3,maxFps:SCENE_VFX_FPS,lightAllColors:false,imageTintEnabled:false,imageTint:'#c20000',lightModel:'pulse',pulseTintLow:'#faf0f0',pulseTintHigh:'#3d0000',pulseOmniTint:'#3d0000',pulseOmniTintLow:'#faf0f0',pulseColorMode:'tint',pulseColors:'#0044ff,#ff8800',pulseColorWidth:30,pulseAllBrightness:56/255,...Object.fromEntries(PULSE_CONTROLS.map(c=>[c.key,c.initial])) as Record<PulseKey,number>,...Object.fromEntries(RETIRED_OMNI_BRIGHTNESS_CONTROLS.map(c=>[c.key,c.initial])) as Record<RetiredOmniBrightnessKey,number>,...Object.fromEntries(RETIRED_FLARE_CONTROLS.map(c=>[c.key,c.initial])) as Record<RetiredFlareKey,number>,...LIGHT_DEFAULTS,...WAVE_DEFAULTS});
export function normalizeSceneVfx(raw: unknown): SceneVfx {
 const r=(raw&&typeof raw==='object'?raw:{}) as Partial<SceneVfx>;
 const number=(v:unknown,f:number,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):f;
 const light=Object.fromEntries(RETIRED_LIGHT_CONTROLS.map(({key,initial,min,max})=>[key,number(r[key],initial,min,max)])) as Record<SceneLightKey,number>;
 const pulse=Object.fromEntries(PULSE_CONTROLS.map(c=>[c.key,c.integer?Math.round(number(r[c.key],c.initial,c.min,c.max)):number(r[c.key],c.initial,c.min,c.max)])) as Record<PulseKey,number>;
 const brightness=Object.fromEntries(RETIRED_OMNI_BRIGHTNESS_CONTROLS.map(c=>[c.key,number(r[c.key],c.initial,c.min,c.max)])) as Record<RetiredOmniBrightnessKey,number>;
 const flare=Object.fromEntries(RETIRED_FLARE_CONTROLS.map(c=>[c.key,number(r[c.key],c.initial,c.min,c.max)])) as Record<RetiredFlareKey,number>;
 const wave=Object.fromEntries(WAVE_CONTROLS.map(({key,initial,min,max})=>[key,number(r[key],initial,min,max)])) as Record<WaveKey,number>;
 const color=(value:unknown,fallback:string)=>typeof value==='string'&&/^#[a-f\d]{6}$/i.test(value)?value:fallback;
 return {...light,...pulse,...brightness,...flare,...wave,pulseRangeMode:r.pulseRangeMode==='auto'?'auto':(r.pulseRangeMode==='manual'||!!raw&&typeof raw==='object')?'manual':DEFAULT_SCENE_VFX.pulseRangeMode,pulseSensitivity:number(r.pulseSensitivity,DEFAULT_SCENE_VFX.pulseSensitivity,.25,8),pulseDropContrast:number(r.pulseDropContrast,DEFAULT_SCENE_VFX.pulseDropContrast,1,4),imageTintEnabled:typeof r.imageTintEnabled==='boolean'?r.imageTintEnabled:false,imageTint:color(r.imageTint,'#c20000'),pulseColorWidth:number(r.pulseColorWidth,30,1,180),pulseAllBrightness:number(r.pulseAllBrightness,DEFAULT_SCENE_VFX.pulseAllBrightness,0,1),lightModel:r.lightModel==='legacy'?'legacy':'pulse',pulseTintLow:color(r.pulseTintLow,DEFAULT_SCENE_VFX.pulseTintLow),pulseTintHigh:color(r.pulseTintHigh,DEFAULT_SCENE_VFX.pulseTintHigh),pulseOmniTintLow:color(r.pulseOmniTintLow,color(r.pulseTintLow,DEFAULT_SCENE_VFX.pulseTintLow)),pulseOmniTint:color(r.pulseOmniTint,typeof r.pulseAllBrightness==='number'&&Number.isFinite(r.pulseAllBrightness)?'#'+Math.round(number(r.pulseAllBrightness,DEFAULT_SCENE_VFX.pulseAllBrightness,0,1)*255).toString(16).padStart(2,'0')+'0000':DEFAULT_SCENE_VFX.pulseOmniTint),pulseColorMode:r.pulseColorMode==='all'?'all':'tint',pulseColors:typeof r.pulseColors==='string'?pulsePalette(r.pulseColors).join(','):DEFAULT_SCENE_VFX.pulseColors,lightAllColors:typeof r.lightAllColors==='boolean'?r.lightAllColors:false,audioLight:typeof r.audioLight==='string'&&/^#[a-f\d]{6}$/i.test(r.audioLight)?r.audioLight:DEFAULT_SCENE_VFX.audioLight,
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

/** Original continuous low-bass motion with a faster attack and a gentle return. */
export function followBass(previous:number,next:number,seconds:number){
 const target=Math.max(0,Math.min(1,next)),dt=Math.max(0,Math.min(.1,seconds));
 const time=target>previous ? .012 : .045;
 return previous+(target-previous)*(1-Math.exp(-dt/time));
}

/** Peak reference changes gain only, never holds the current zoom target. */
export function createBassDynamics(){
 let reference=.03;
 return {
  reset(){reference=.03;},
  sample(amplitude:number,seconds:number){
   const value=Math.max(0,Math.min(1,amplitude)),dt=Math.max(0,Math.min(.1,seconds));
   reference=Math.max(.03,value,reference*Math.exp(-dt/12));
   const floor=Math.max(.001,reference*.02);
   return Math.max(0,Math.min(1,(value-floor)/(reference-floor)));
  },
 };
}
