import type * as THREE from "three";
import type { TextScene } from "../textScene";
import { effectsFor, type Appearance } from "./resolve";
export const GRAPH_EFFECT_TARGETS = [
  "omnium.nodes.body",
  "omnium.nodes.background",
  "omnium.nodes.contour",
  "omnium.selection",
  "symbols.nodes",
  "text.nodes",
  "omnium.binders.path",
  "omnium.binders.background",
  "symbols.binders",
  "text.binders",
] as const;
export type GraphEffectItem = {
  target: string;
  id: string;
  object: THREE.Object3D;
  color: string;
  opacity: number;
  kind: "glyph" | "icon" | "surface" | "contour" | "sphere" | "path";
  path?: THREE.Curve<THREE.Vector3>;
};
/** Renderer references only; this never edits structural data or placements. */
export function* graphEffectItems(source: TextScene): Generator<GraphEffectItem> {
  for (const [id, node] of source.nodes) {
    if (!node.group.visible) continue;
    const base = { id, color: node.color, opacity: node.opacity };
    if (node.sphere && node.sprite.visible)
      yield { ...base, target: "omnium.nodes.body", object: node.sprite, kind: "sphere" };
    if (node.visual?.visible)
      yield { ...base, target: "symbols.nodes", object: node.visual, kind: "icon" };
    if (node.text.visible) {
      const text = { ...base, object: node.text, opacity: node.text.material.opacity };
      yield { ...text, target: "text.nodes", kind: "glyph" };
      yield { ...text, target: "omnium.nodes.background", kind: "surface" };
      yield { ...text, target: "omnium.nodes.contour", kind: "contour" };
    }
    if (node.outline.visible)
      yield {
        ...base,
        target: "omnium.selection",
        object: node.outline,
        opacity: node.outline.material.opacity,
        kind: "contour",
      };
  }
  for (const binder of source.connectors) {
    const base = {
      id: binder.data.key,
      color: binder.line.material.color.getStyle(),
      opacity: binder.line.material.opacity,
    };
    if (binder.path)
      yield {
        ...base,
        target: "omnium.binders.path",
        object: binder.line,
        kind: "path",
        path: binder.path,
      };
    yield { ...base, target: "symbols.binders", object: binder.arrow, kind: "icon" };
    if (binder.label?.visible) {
      const text = { ...base, object: binder.label, opacity: binder.textOpacity };
      yield { ...text, target: "text.binders", kind: "glyph" };
      yield { ...text, target: "omnium.binders.background", kind: "surface" };
    }
  }
}
export const graphAnimationsMoving = (theme: Appearance, source: TextScene | null) => {
  if (!source) return false;
  const active = new Map(
    GRAPH_EFFECT_TARGETS.map((id) => {
      const fx = effectsFor(theme, id);
      return [id, fx.effect !== "off" && fx.motion > 0 && fx.intensity > 0 && fx.density > 0];
    }),
  );
  for (const item of graphEffectItems(source))
    if (active.get(item.target as (typeof GRAPH_EFFECT_TARGETS)[number]) && item.object.visible)
      return true;
  return false;
};
