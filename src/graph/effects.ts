export const EFFECT_KINDS = ["stars", "electric-text", "lightning", "falling-stars", "dust", "sparks", "off"] as const;
export type EffectKind = (typeof EFFECT_KINDS)[number];
export const ANIMATION_TARGETS = ["windows", "buttons", "fields", "nodes", "binders", "background"] as const;
export type AnimationTarget = (typeof ANIMATION_TARGETS)[number];
export type SurfaceTarget = Exclude<AnimationTarget, "nodes" | "binders">;
export const ANIMATION_LABELS: Record<AnimationTarget, string> = { windows: "Windows / frames", buttons: "Buttons", fields: "Fields", nodes: "Nodes", binders: "Binders", background: "Background" };
export type SparkleStyle = { effect: EffectKind; intensity: number; density: number; motion: number; boltLength?: number; color?: string };
export type SparkleDefaults = { effect: EffectKind; atmosphere: boolean; effectIntensity: number; density: number; motion: number; lightningLength?: number; effectColor?: string };
type EffectSources = SparkleDefaults & {
  nodes?: { effects?: Partial<SparkleStyle> }; binders?: { effects?: Partial<SparkleStyle> };
  effectTargets?: Partial<Record<AnimationTarget, boolean>>;
  surfaceEffects?: Partial<Record<SurfaceTarget, Partial<SparkleStyle>>>;
};
export function resolveSparkles(global: SparkleDefaults, overrides?: Partial<SparkleStyle>): SparkleStyle {
  return { effect: overrides?.effect ?? (global.atmosphere ? global.effect : "off"), intensity: overrides?.intensity ?? global.effectIntensity, density: overrides?.density ?? global.density, motion: overrides?.motion ?? global.motion, color: overrides?.color ?? global.effectColor, boltLength: overrides?.boltLength ?? global.lightningLength ?? 0.35 };
}
export function resolveTargetSparkles(source: EffectSources, target: AnimationTarget): SparkleStyle {
  const override = target === "nodes" || target === "binders" ? source[target]?.effects : source.surfaceEffects?.[target];
  const value = resolveSparkles(source, override);
  return source.effectTargets?.[target] === false ? { ...value, effect: "off" } : value;
}
export function normalizeSparkleOverrides(input: unknown): Partial<SparkleStyle> {
  const result: Partial<SparkleStyle> = {};
  if (!input || typeof input !== "object") return result;
  const value = input as Partial<SparkleStyle>;
  if (/^#[0-9a-f]{6}$/i.test(value.color ?? "")) result.color = value.color;
  if (EFFECT_KINDS.includes(value.effect as EffectKind)) result.effect = value.effect;
  for (const key of ["intensity", "density", "motion", "boltLength"] as const) if (typeof value[key] === "number" && Number.isFinite(value[key])) result[key] = Math.max(0, Math.min(1, value[key]));
  return result;
}
export const effectVisible = (fx: SparkleStyle) => fx.effect !== "off" && fx.intensity > 0 && fx.density > 0;
export function effectSeed(id: string) { let value = 2166136261; for (const c of id) value = Math.imul(value ^ c.charCodeAt(0), 16777619); return (value >>> 0) / 4294967296; }
/** Normalized falling path: downwards with a small sideways drift, wrapping at the bottom. */
export function fallingStar(seed: number, index: number, seconds: number) {
  const offset = effectSeed(`${seed}:${index}`);
  return { x: ((offset + Math.sin(seconds * 0.6 + index) * 0.035) % 1 + 1) % 1, y: (seed + index * 0.61803398875 + seconds * (0.045 + offset * 0.035)) % 1,
    twinkle: 0.12 + 0.88 * Math.pow((Math.sin(seconds * 3.5 + offset * 50) + 1) / 2, 3) };
}
export function perimeterPoint(width: number, height: number, progress: number) {
  let p = ((progress % 1 + 1) % 1) * 2 * (width + height);
  if (p < width) return { x: p, y: 0 }; p -= width;
  if (p < height) return { x: width, y: p }; p -= height;
  if (p < width) return { x: width - p, y: height }; return { x: 0, y: height - (p - width) };
}
