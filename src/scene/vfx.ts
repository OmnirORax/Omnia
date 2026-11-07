/** Only the five user-requested controls are portable settings. No capture/session data. */
export type SceneVfx = { audioLight: string; audioBounce: number; waves: boolean; distortion: number; glitching: number };
export const DEFAULT_SCENE_VFX: Readonly<SceneVfx> = Object.freeze({audioLight:'#aa3300',audioBounce:1.12,waves:true,distortion:.4,glitching:.3});
export function normalizeSceneVfx(raw: unknown): SceneVfx {
 const r=(raw&&typeof raw==='object'?raw:{}) as Partial<SceneVfx>;
 const number=(v:unknown,f:number,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):f;
 return {audioLight:typeof r.audioLight==='string'&&/^#[a-f\d]{6}$/i.test(r.audioLight)?r.audioLight:DEFAULT_SCENE_VFX.audioLight,
 audioBounce:number(r.audioBounce,1.12,1,1.5),waves:typeof r.waves==='boolean'?r.waves:true,
 distortion:number(r.distortion,.4,0,1),glitching:number(r.glitching,.3,0,1)};
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
