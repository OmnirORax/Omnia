import type { Visual } from "./assets.ts";
import { visualFootprint } from "./assets.ts";
import { labelSize } from "./labels.ts";
import type { DisplayBinder } from "./binders.ts";
import type { Document, Placement, XYZ } from "./structural.ts";

export const ARROW_LENGTH = 0.24;
export const OPERATOR_SCALE = 0.45;
export const BINDER_LENGTH_RATIO = 3;
export const arrowLength = (visual?: Visual) => ARROW_LENGTH * (visual?.size ?? 1);
export function operatorSize(visual?: Visual) {
  return OPERATOR_SCALE * (visual?.size ?? 1.4);
}
/** Custom assets are normalized to a unit box; character visuals may be three units wide.
 * Use their occupied envelope so sizing does not depend on asynchronous asset loading. */
export function operatorExtent(visual?: Visual) {
  if (!visual?.assetId && !visual?.character) return arrowLength(visual);
  return operatorSize(visual) * Math.hypot(visual.character ? 3 : 1, 1, visual.assetId ? 1 : 0);
}
export function binderGap(binder: Pick<DisplayBinder, "visual" | "label">, direction?: XYZ) {
  const label = labelSize(binder.label);
  const text = binder.visual?.showText === false ? 0 : 0.7 * (direction ? Math.abs(direction.x) * label.width + Math.abs(direction.y) * label.height : Math.max(label.width, label.height));
  return Math.max(BINDER_LENGTH_RATIO * operatorExtent(binder.visual), text + 0.35);
}
export function placementFootprint(doc: Document, placement: Placement, sphereDiameter?: number) {
  return visualFootprint(labelSize(doc.entities.find(e => e.id === placement.entityId)?.label ?? ""), placement.visual, sphereDiameter);
}
export function surfaceExtent(doc: Document, placement: Placement, direction: XYZ, sphereDiameter?: number) {
  const size = placementFootprint(doc, placement, sphereDiameter);
  if (size.sphere) return size.width / 2;
  return Math.min(...(["x", "y", "z"] as const).map(axis => Math.abs(direction[axis]) > 1e-9
    ? (axis === "x" ? size.width : axis === "y" ? size.height : size.depth) / 2 / Math.abs(direction[axis]) : Infinity));
}
export function minimumBinderDistance(doc: Document, binder: DisplayBinder, direction: XYZ, sphereDiameter?: number) {
  const from = doc.placements.find(p => p.id === binder.source)!;
  const to = doc.placements.find(p => p.id === binder.target)!;
  return surfaceExtent(doc, from, direction, sphereDiameter) + surfaceExtent(doc, to, direction, sphereDiameter) + binderGap(binder, direction);
}
