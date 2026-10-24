export type NumericRangeRule = { by: string; otherwise: { min?: number; max?: number }; cases: Record<string, { min?: number; max?: number }> };
export type NumericSpec = { min?: number; max?: number; numericRange?: NumericRangeRule };
/** The property pool owns mode constraints; editors and state owners share this resolver. */
export function numericRange(spec: NumericSpec, read?: (property: string) => unknown) {
  const rule = spec.numericRange, selected = rule ? rule.cases[String(read?.(rule.by))] ?? rule.otherwise : undefined;
  return { min: Math.max(spec.min ?? -Infinity, selected?.min ?? -Infinity), max: Math.min(spec.max ?? Infinity, selected?.max ?? Infinity) };
}
export function boundedNumber(spec: NumericSpec, value: number, read?: (property: string) => unknown) {
  const range = numericRange(spec, read);
  return Math.max(range.min, Math.min(range.max, value));
}
