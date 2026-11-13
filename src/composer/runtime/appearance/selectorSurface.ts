/** Shared source-over strength for DOM, SVG and scene selection backgrounds.
 * Colors are blended in display sRGB, not the scene's linear working space. */
export const SELECTOR_SURFACE_OPACITY = .164;
export const SELECTOR_PAINT_PEAK = .82;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
export const selectorSurfaceStrength = (opacity: number, strength: number, fill = SELECTOR_SURFACE_OPACITY) =>
  clamp(opacity) * clamp(strength / SELECTOR_PAINT_PEAK) * clamp(fill);
/** The parent already contributes through a transparent child. Apply only the
 * remaining source-over tint, instead of accumulating another full layer. */
export function remainingSurfaceTint(opacity: number, strength: number, inherited: number, fill = SELECTOR_SURFACE_OPACITY) {
  const wanted = selectorSurfaceStrength(opacity, strength, fill);
  return clamp((wanted - inherited) / Math.max(1e-6, 1 - inherited));
}
export function paintAlpha(color: string) {
  if (color === "transparent") return 0;
  const slash = color.match(/\/\s*([\d.]+)(%)?\s*\)/);
  if (slash) return clamp(Number(slash[1]) / (slash[2] ? 100 : 1));
  const rgba = color.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/);
  return rgba ? clamp(Number(rgba[1])) : 1;
}
