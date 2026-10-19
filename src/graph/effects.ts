export type EffectKind = "stars" | "dust" | "sparks" | "off";
export type SparkleStyle = { effect: EffectKind; intensity: number; density: number; motion: number };
export type SparkleDefaults = { effect: EffectKind; atmosphere: boolean; effectIntensity: number; density: number; motion: number };
export function resolveSparkles(global: SparkleDefaults, overrides?: Partial<SparkleStyle>): SparkleStyle {
  return { effect: overrides?.effect ?? (global.atmosphere ? global.effect : "off"), intensity: overrides?.intensity ?? global.effectIntensity, density: overrides?.density ?? global.density, motion: overrides?.motion ?? global.motion };
}
export const effectVisible = (fx: SparkleStyle) => fx.effect !== "off" && fx.intensity > 0 && fx.density > 0;
export function effectSeed(id: string) { let value = 2166136261; for (const c of id) value = Math.imul(value ^ c.charCodeAt(0), 16777619); return (value >>> 0) / 4294967296; }
export function perimeterPoint(width: number, height: number, progress: number) {
  let p = ((progress % 1 + 1) % 1) * 2 * (width + height);
  if (p < width) return { x: p, y: 0 }; p -= width;
  if (p < height) return { x: width, y: p }; p -= height;
  if (p < width) return { x: width - p, y: height }; return { x: 0, y: height - (p - width) };
}
