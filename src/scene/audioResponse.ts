import { curveValue, makeCurve, validCurve, type Curve } from '../properties/curve.ts';

export const RESPONSE_HZ = 60, HISTORY_SECONDS = 8, LOUDNESS_BINS = 32;
const TARGETS=['light','bounce'] as const;
const WINDOW = RESPONSE_HZ*HISTORY_SECONDS;
export type Response = { loudness: Curve; recurrence: Curve };
export type AudioResponse = { version: 1; light: Response; bounce: Response };
export function defaultAudioResponse(light = 1.7, bounce = 1.3): AudioResponse {
  const response = (amount: number): Response => ({ loudness:makeCurve(x => Math.max(0,(x-.4)/.6)*amount),recurrence:makeCurve(x => 1-x) });
  return {version:1,light:response(Math.max(0,Math.min(1,light/2))),bounce:response(Math.max(0,Math.min(1,(bounce-1)/.5)))};
}
export function validateAudioResponse(value: unknown): asserts value is AudioResponse {
  const v = value as AudioResponse;
  if (!v || v.version !== 1 || !v.light || !v.bounce || !validCurve(v.light.loudness) || !validCurve(v.light.recurrence) || !validCurve(v.bounce.loudness) || !validCurve(v.bounce.recurrence)) throw Error('Unsupported or invalid audio response curves.');
}
export function audioResponse(value: unknown, light?: number, bounce?: number): AudioResponse {
  if (value === undefined) return defaultAudioResponse(light,bounce);
  validateAudioResponse(value);
  return {version:1,light:{loudness:[...value.light.loudness],recurrence:[...value.light.recurrence]},bounce:{loudness:[...value.bounce.loudness],recurrence:[...value.bounce.recurrence]}};
}
export function responseStrength(response: Response, loudness: number, recurrence: number) {
  return loudness > 0 ? curveValue(response.loudness,loudness)*curveValue(response.recurrence,recurrence) : 0;
}
/** Combine channel energy before taking RMS; phase-opposed stereo must not cancel. */
export function rmsLevel(channels: readonly Float32Array[]): number {
  let sum=0,count=0;
  for(const channel of channels){for(let i=0;i<channel.length;i++)sum+=channel[i]*channel[i];count+=channel.length;}
  return count?Math.sqrt(sum/count):0;
}
/** One RMS input, a 480-entry ring and 32 counters; no spectrum or sound classification. */
export function createAudioResponse(initial = defaultAudioResponse()) {
  let settings = initial, cursor = 0, slot = -1;
  const ring = new Int8Array(WINDOW).fill(-1), counts = new Uint16Array(LOUDNESS_BINS);
  const result = { loudness:0,recurrence:0,light:0,bounce:0,counts,samples:WINDOW };
  function reset() { ring.fill(-1);counts.fill(0);cursor=0;slot=-1;result.loudness=result.recurrence=result.light=result.bounce=0; }
  function insert(bin: number) {
    const old = ring[cursor];if (old >= 0) counts[old]--;
    ring[cursor] = bin;if (bin >= 0) counts[bin]++;
    cursor = (cursor+1)%WINDOW;
  }
  return {
    result, reset,
    due(now: number) { return Number.isFinite(now) && Math.floor(now*RESPONSE_HZ+1e-6) !== slot; },
    configure(value: AudioResponse) {
      settings = value;
      result.light = responseStrength(settings.light,result.loudness,result.recurrence);
      result.bounce = responseStrength(settings.bounce,result.loudness,result.recurrence);
    },
    sample(rms: number, now: number) {
      if (!Number.isFinite(now)) return result;
      const next = Math.floor(now*RESPONSE_HZ+1e-6);if (next === slot) return result;
      if (slot >= 0 && (next < slot || next-slot >= WINDOW)) reset();
      const elapsed = slot < 0 ? 1/RESPONSE_HZ : Math.min(.1,(next-slot)/RESPONSE_HZ);
      // Missing samples are unknown, rather than invented repeated sounds.
      if (slot >= 0) for (let i=slot+1;i<next;i++) insert(-1);
      slot = next;
      const amplitude = Number.isFinite(rms) ? Math.max(0,Math.min(1,rms)) : 0;
      result.loudness = amplitude > .001 ? Math.max(0,Math.min(1,(20*Math.log10(amplitude)+60)/60)) : 0;
      const bin = result.loudness > 0 ? Math.min(LOUDNESS_BINS-1,Math.floor(result.loudness*LOUDNESS_BINS)) : -1;
      insert(bin);
      // Neighbor buckets avoid a discontinuity when nearly equal levels straddle an edge.
      result.recurrence = bin < 0 ? 0 : ((counts[bin-1]??0)+counts[bin]+(counts[bin+1]??0))/WINDOW;
      for (const key of TARGETS) {
        const target = responseStrength(settings[key],result.loudness,result.recurrence), time = target > result[key] ? .02 : .08;
        result[key] += (target-result[key])*(1-Math.exp(-elapsed/time));
        if (result[key] < .00001) result[key] = 0;
      }
      return result;
    },
  };
}
