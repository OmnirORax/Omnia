import type { SelectionRegion } from "./selectionGeometry";
import { matchingVisualParts, type SelectionConstraint, type SelectionRule, type VisualPart } from "./visualSelection.ts";

export type SelectionMask = { contour: boolean; region: SelectionRegion | null };
export type MaskPart = "contour" | "inside" | "outside";
export const DEFAULT_SELECTION_MASK: SelectionMask = { contour: true, region: null };

/** Picking remains possible in an unchecked interior. The mask sets inclusion,
 * while the working geometry determines where later exceptions can be picked. */
export function workingGeometry(geometry: SelectionConstraint, mask: SelectionMask): SelectionConstraint {
  return { ...geometry, contour: true,
    region: geometry.path?.closed ? mask.region === "outside" || mask.region === "both" ? "both" : "inside" : undefined };
}
export function maskedGeometry(geometry: SelectionConstraint, mask: SelectionMask): SelectionConstraint {
  return { ...geometry, contour: mask.contour, region: geometry.path?.closed ? mask.region ?? undefined : undefined };
}
export function geometryBaseline(geometry: SelectionConstraint, mask: SelectionMask): SelectionRule[] {
  return [{ ...geometry, include: false, implicit: true }, { ...maskedGeometry(geometry, mask), include: true }];
}
/** Reset the changed region, then restore enabled overlaps. Unrelated regions
 * keep their individual exceptions; contour and fill may touch the same part. */
export function geometryMaskChange(geometry: SelectionConstraint, mask: SelectionMask, part: MaskPart): SelectionRule[] {
  if (part !== "contour" && !geometry.path?.closed) return [];
  const changed: SelectionConstraint = { ...geometry, contour: part === "contour", region: part === "contour" ? undefined : part };
  return [{ ...changed, include: false, implicit: true }, { ...maskedGeometry(geometry, mask), scope: changed, include: true }];
}

/** One toggle for every category/individual: mixed becomes included; all included
 * becomes excluded. Preview and commit use the same decision. */
export function selectionToggleRule(parts: VisualPart[], included: readonly VisualPart[], constraint: SelectionConstraint): SelectionRule {
  const keys = new Set(included.map(part => part.key));
  const peers = matchingVisualParts(parts, { ...constraint, include: true });
  return { ...constraint, include: !peers.length || peers.some(part => !keys.has(part.key)) };
}
