/** Quantize to a control's declared resolution without floating-point drift. */
export function rangeValue(value: number, min: number, max: number, step: number) {
  if (!Number.isFinite(value)) return min;
  const bounded = Math.max(min, Math.min(max, value));
  if (!(step > 0)) return bounded;
  return Math.max(min, Math.min(max, Number((min + Math.round((bounded - min) / step) * step).toPrecision(12))));
}
