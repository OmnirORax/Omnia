import { audioResponse, defaultAudioResponse, type AudioResponse } from './audioResponse.ts';
import { AUDIO_TUNING_DEFAULTS,normalizeAudioTuning,type AudioTuning } from './audioTuning.ts';
import {PULSE_CONTROLS,RETIRED_FLARE_CONTROLS,type PulseKey,type RetiredFlareKey} from './pulse.ts';
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
 {key:'waveAmplitudeX',label:'Horizontal displacement (%)',initial:.05,min:0,max:5,step:.025},
 {key:'waveAmplitudeY',label:'Vertical displacement (%)',initial:.05,min:0,max:5,step:.025},
 {key:'waveFrequencyX',label:'Horizontal wave count',initial:1,min:0,max:40,step:.25},
 {key:'waveFrequencyY',label:'Vertical wave count',initial:40,min:0,max:40,step:.25},
 {key:'waveSpeedX',label:'Horizontal phase speed (rad/s)',initial:4,min:-20,max:20,step:.05},
 {key:'waveSpeedY',label:'Vertical phase speed (rad/s)',initial:3,min:-20,max:20,step:.05},
] as const;
export type WaveKey=typeof WAVE_CONTROLS[number]['key'];
export const WAVE_PRESETS = [
 {label:'Preset 1',waveAmplitudeX:.25,waveAmplitudeY:.3,waveFrequencyX:4,waveFrequencyY:10,waveSpeedX:2,waveSpeedY:3},
 {label:'Preset 2',waveAmplitudeX:.1,waveAmplitudeY:.1,waveFrequencyX:2.5,waveFrequencyY:7.5,waveSpeedX:4,waveSpeedY:3},
] as const;

const WAVE_DEFAULTS=Object.fromEntries(WAVE_CONTROLS.map(({key,initial})=>[key,initial])) as Record<WaveKey,number>;
export type SceneLightKey = typeof RETIRED_LIGHT_CONTROLS[number]['key'];
export type SceneVfx = AudioTuning & { audioResponse:AudioResponse; pulseRangeMode:"manual"|"auto";pulseSensitivity:number;pulseInterval:number;pulseDropContrast:number; audioLight: string; audioBounce: number; waves: boolean; distortion: number; glitching: number; maxFps: number; lightModel:"pulse"|"legacy"; pulseTintLow:string; pulseTintHigh:string;imageTintEnabled:boolean;imageTint:string } & Record<WaveKey,number> & Record<RetiredFlareKey,number> & Record<PulseKey,number> & Record<SceneLightKey,number>;
const LIGHT_DEFAULTS=Object.fromEntries(RETIRED_LIGHT_CONTROLS.map(({key,initial})=>[key,initial])) as Record<SceneLightKey,number>;
export const DEFAULT_SCENE_VFX: Readonly<SceneVfx> = Object.freeze({...AUDIO_TUNING_DEFAULTS,audioResponse:defaultAudioResponse(),pulseRangeMode:'auto',pulseSensitivity:2,pulseInterval:100,pulseDropContrast:1,audioLight:'#aa3300',audioBounce:1.1,waves:true,distortion:.4,glitching:.3,maxFps:SCENE_VFX_FPS,imageTintEnabled:false,imageTint:'#ff00ea',lightModel:'pulse',pulseTintLow:'#e1fefb',pulseTintHigh:'#172f35',...Object.fromEntries(PULSE_CONTROLS.map(c=>[c.key,c.initial])) as Record<PulseKey,number>,...Object.fromEntries(RETIRED_FLARE_CONTROLS.map(c=>[c.key,c.initial])) as Record<RetiredFlareKey,number>,...LIGHT_DEFAULTS,...WAVE_DEFAULTS});
export function normalizeSceneVfx(raw: unknown): SceneVfx {
 const r=(raw&&typeof raw==='object'?raw:{}) as Partial<SceneVfx>;
 const number=(v:unknown,f:number,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):f;
 const light=Object.fromEntries(RETIRED_LIGHT_CONTROLS.map(({key,initial,min,max})=>[key,number(r[key],initial,min,max)])) as Record<SceneLightKey,number>;
 const pulse=Object.fromEntries(PULSE_CONTROLS.map(c=>[c.key,c.integer?Math.round(number(r[c.key],c.initial,c.min,c.max)):number(r[c.key],c.initial,c.min,c.max)])) as Record<PulseKey,number>;
 const flare=Object.fromEntries(RETIRED_FLARE_CONTROLS.map(c=>[c.key,number(r[c.key],c.initial,c.min,c.max)])) as Record<RetiredFlareKey,number>;
 const wave=Object.fromEntries(WAVE_CONTROLS.map(({key,initial,min,max})=>[key,number(r[key],initial,min,max)])) as Record<WaveKey,number>;
 const color=(value:unknown,fallback:string)=>typeof value==='string'&&/^#[a-f\d]{6}$/i.test(value)?value:fallback;
 return {...normalizeAudioTuning(r),...light,...pulse,...flare,...wave,audioResponse:r.audioResponse===undefined&&r.pulseAmount===undefined&&r.audioBounce===undefined?audioResponse(DEFAULT_SCENE_VFX.audioResponse):audioResponse(r.audioResponse,number(r.pulseAmount,DEFAULT_SCENE_VFX.pulseAmount,0,2),number(r.audioBounce,DEFAULT_SCENE_VFX.audioBounce,1,1.5)),pulseRangeMode:r.pulseRangeMode==='auto'?'auto':(r.pulseRangeMode==='manual'||!!raw&&typeof raw==='object')?'manual':DEFAULT_SCENE_VFX.pulseRangeMode,pulseInterval:number(r.pulseInterval,DEFAULT_SCENE_VFX.pulseInterval,5,1500),pulseSensitivity:number(r.pulseSensitivity,DEFAULT_SCENE_VFX.pulseSensitivity,.25,8),pulseDropContrast:number(r.pulseDropContrast,DEFAULT_SCENE_VFX.pulseDropContrast,1,4),imageTintEnabled:typeof r.imageTintEnabled==='boolean'?r.imageTintEnabled:false,imageTint:color(r.imageTint,DEFAULT_SCENE_VFX.imageTint),lightModel:r.lightModel==='legacy'?'legacy':'pulse',pulseTintLow:color(r.pulseTintLow,DEFAULT_SCENE_VFX.pulseTintLow),pulseTintHigh:color(r.pulseTintHigh,DEFAULT_SCENE_VFX.pulseTintHigh),audioLight:typeof r.audioLight==='string'&&/^#[a-f\d]{6}$/i.test(r.audioLight)?r.audioLight:DEFAULT_SCENE_VFX.audioLight,
 audioBounce:number(r.audioBounce,DEFAULT_SCENE_VFX.audioBounce,1,1.5),waves:typeof r.waves==='boolean'?r.waves:true,
 distortion:number(r.distortion,.4,0,1),glitching:number(r.glitching,.3,0,1),maxFps:Math.round(number(r.maxFps,SCENE_VFX_FPS,MIN_SCENE_VFX_FPS,MAX_SCENE_VFX_FPS))};
}
export function serializeSceneVfx(value:unknown) { return JSON.stringify(normalizeSceneVfx(value),null,2); }
/** Retain pacing phase on fast displays, discard elapsed debt after a slow frame. */
export function nextVfxDeadline(previous:number,now:number,maxFps=SCENE_VFX_FPS){
 const interval=1000/Math.max(MIN_SCENE_VFX_FPS,Math.min(MAX_SCENE_VFX_FPS,maxFps)),next=(previous||now)+interval;
 return next<now?now+interval:next;
}
