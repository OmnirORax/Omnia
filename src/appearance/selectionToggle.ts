import type { Point, SelectionRegion } from "./selectionGeometry";
import { matchingVisualParts, pointerInSelectionScope, type VisualMeasurements, type SelectionConstraint, type SelectionRule, type VisualPart } from "./visualSelection.ts";

export type SelectionMask = { contour: boolean; region: SelectionRegion | null; backgrounds?: boolean };
export type MaskPart = "contour" | "inside" | "outside";
export const DEFAULT_SELECTION_MASK: SelectionMask = { contour: true, region: null, backgrounds: false };

/** Active regions constrain detection; a neutral frame follows the pointer side. */
export function workingGeometry(geometry: SelectionConstraint, mask: SelectionMask): SelectionConstraint {
  if (!mask.contour && !mask.region) return geometry.path?.closed
    ? { ...geometry, contour: false, region: "both" }
    : { ...geometry, contour: true, region: undefined };
  return maskedGeometry(geometry, mask);
}
export function maskedGeometry(geometry: SelectionConstraint, mask: SelectionMask): SelectionConstraint {
  return { ...geometry, contour: mask.contour, region: geometry.path?.closed ? mask.region ?? undefined : undefined };
}
export function geometryBaseline(geometry: SelectionConstraint, mask: SelectionMask): SelectionRule[] {
  const detection = mask.backgrounds === undefined ? {} : { backgrounds: mask.backgrounds };
  return [{ ...geometry, ...detection, include: false, implicit: true }, { ...maskedGeometry(geometry, mask), ...detection, include: true }];
}
/** Reset the changed region, then restore enabled overlaps. Unrelated regions
 * keep their individual exceptions; contour and fill may touch the same part. */
export function geometryMaskChange(geometry: SelectionConstraint, mask: SelectionMask, part: MaskPart): SelectionRule[] {
  if (part !== "contour" && !geometry.path?.closed) return [];
  const changed: SelectionConstraint = { ...geometry, contour: part === "contour", region: part === "contour" ? undefined : part };
  const detection = mask.backgrounds === undefined ? {} : { backgrounds: mask.backgrounds };
  return [{ ...changed, ...detection, include: false, implicit: true }, { ...maskedGeometry(geometry, mask), ...detection, scope: changed, include: true }];
}

/** One toggle for every category/individual: mixed becomes included; all included
 * becomes excluded. Preview and commit use the same decision. */
export function selectionToggleRule(parts: VisualPart[], included: readonly VisualPart[], constraint: SelectionConstraint, measure?: VisualMeasurements): SelectionRule {
  const keys = new Set(included.map(part => part.key));
  const peers = matchingVisualParts(parts, { ...constraint, include: true }, measure);
  return { ...constraint, include: !peers.length || peers.some(part => !keys.has(part.key)) };
}

/** A neutral closed frame follows the pointer side without changing inclusion. */
export function detectionGeometry(geometry: SelectionConstraint, mask: SelectionMask, element: Element, point: Point): SelectionConstraint {
  if (mask.contour || mask.region || !geometry.path?.closed) return geometry;
  const inside = pointerInSelectionScope({ ...geometry, contour: false, region: "inside" }, element, point);
  return { ...geometry, contour: false, region: inside ? "inside" : "outside" };
}

/** Removal is never a toggle-on. A nonselected pointed part means clear-all;
 * otherwise keep the current selector constraint when it contains that hit. */
export function selectionRemovalRule(parts: VisualPart[], included: readonly VisualPart[], pointed: VisualPart | undefined, constraint: SelectionConstraint, measure?: VisualMeasurements): SelectionRule | null {
  if (!pointed || !included.some(part => part.key === pointed.key)) return null;
  const peers = matchingVisualParts(parts, { ...constraint, include: false }, measure);
  if (peers.some(part => part.key === pointed.key)) return { ...constraint, include: false };
  return { boundary: constraint.boundary, part: pointed.key, include: false };
}
