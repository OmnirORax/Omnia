/** Selection pulse changes ink only, not glyph geometry. Retain every other
 * declaration so real typography, movement and clipping changes still invalidate. */
export function effectGeometryStyle(style: string | null) {
  return (style ?? "").split(";").map(value => value.trim()).filter(value => value &&
    !/^--omnium-selector-(?:glyph|surface)-mix\s*:/.test(value)).join(";");
}
