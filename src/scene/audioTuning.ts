/** Temporary tuning surface. Keep values portable when these controls are hidden. */
export const AUDIO_TUNING_CONTROLS = [
 {key:'audioNoiseFloor',label:'Noise floor',initial:.01,min:0,max:.1,step:.001},
 {key:'audioNoiseKnee',label:'Noise soft knee',initial:.02,min:.001,max:.2,step:.001},
 {key:'pulseHzMin',label:'Pulse low Hz',initial:20,min:0,max:20000,step:1},
 {key:'pulseHzMax',label:'Pulse high Hz',initial:20000,min:0,max:20000,step:1},
 {key:'pulseOnsetFloor',label:'Onset floor',initial:.01,min:0,max:.1,step:.001},
 {key:'pulseOnsetTime',label:'Onset tracking (ms)',initial:20,min:1,max:500,step:1},
 {key:'pulseReferenceMin',label:'Pulse reference floor',initial:.01,min:.001,max:1,step:.001},
 {key:'pulseReferenceTime',label:'Pulse adaptation (s)',initial:8,min:.1,max:30,step:.1},
 {key:'pulseReferenceWeight',label:'Pulse reference weight',initial:.25,min:.01,max:2,step:.01},
 {key:'pulseTrigger',label:'Pulse trigger level',initial:.05,min:0,max:1,step:.01},
 {key:'pulseDuration',label:'Pulse duration (ms)',initial:200,min:5,max:1500,step:5},
 {key:'pulseAttackFraction',label:'Pulse rise fraction',initial:.25,min:.05,max:.95,step:.01},
 {key:'pulseIntervalFill',label:'Pulse interval fill',initial:.8,min:.05,max:1,step:.01},
 {key:'bassHzMin',label:'Bounce low Hz',initial:31,min:0,max:2000,step:1},
 {key:'bassHzMax',label:'Bounce high Hz',initial:65,min:0,max:2000,step:1},
 {key:'bassSmoothing',label:'Bass FFT smoothing',initial:.15,min:0,max:.99,step:.01},
 {key:'bassReferenceMin',label:'Bounce reference floor',initial:.08,min:.001,max:1,step:.001},
 {key:'bassReferenceTime',label:'Bounce adaptation (s)',initial:12,min:.1,max:30,step:.1},
 {key:'bassFloorRatio',label:'Bounce relative floor',initial:.02,min:0,max:.9,step:.01},
 {key:'bassAttack',label:'Bounce attack (ms)',initial:12,min:1,max:1000,step:1},
 {key:'bassRelease',label:'Bounce release (ms)',initial:45,min:1,max:2000,step:1},
] as const;
export type AudioTuning = Record<typeof AUDIO_TUNING_CONTROLS[number]['key'],number>;
export const AUDIO_TUNING_DEFAULTS: Readonly<AudioTuning> = Object.freeze(Object.fromEntries(AUDIO_TUNING_CONTROLS.map(c=>[c.key,c.initial])) as AudioTuning);
export function normalizeAudioTuning(raw: Record<string,unknown>): AudioTuning {
 return Object.fromEntries(AUDIO_TUNING_CONTROLS.map(c=>[c.key,typeof raw[c.key]==='number'&&Number.isFinite(raw[c.key])?Math.max(c.min,Math.min(c.max,raw[c.key] as number)):c.initial])) as AudioTuning;
}
export function frequencyRange(low:number,high:number,hz:number,bins:number) {
 const first=Math.min(bins-1,Math.max(1,Math.floor(Math.min(low,high)/hz)));
 return {first,last:Math.min(bins,Math.max(first+1,Math.ceil(Math.max(low,high)/hz)))};
}
