import type { Appearance } from "./structural.ts";
import type { SparkleStyle } from "./effects.ts";
export type StyleDefaults = { color?: string; opacity: number; glow: number; effects?: Partial<SparkleStyle> };
export function resolveAppearance(defaults: StyleDefaults, fallback: string, override?: Appearance): Required<Appearance> {
  return { color: override?.color ?? defaults.color ?? fallback, opacity: override?.opacity ?? defaults.opacity, glow: override?.glow ?? defaults.glow };
}
