export const CURVE_POINTS = 16;
export type Curve = readonly number[];
export function validCurve(value: unknown): value is Curve {
  return Array.isArray(value) && value.length === CURVE_POINTS && value.every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1);
}
/** Fixed evenly spaced knots; lookup and interpolation take constant work. */
export function curveValue(curve: Curve, input: number): number {
  const x = Math.max(0,Math.min(1,input))*(CURVE_POINTS-1), i = Math.min(CURVE_POINTS-2,Math.floor(x));
  return curve[i]+(curve[i+1]-curve[i])*(x-i);
}
export function makeCurve(value: (x: number) => number): Curve {
  return Array.from({length:CURVE_POINTS},(_,i) => Math.max(0,Math.min(1,value(i/(CURVE_POINTS-1)))));
}
