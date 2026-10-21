import * as THREE from "three";
import type { TextScene } from "../textScene";
import { graphEffectItems, GRAPH_EFFECT_TARGETS } from "./graphEffects";
import type { HighlightShape } from "./highlight";

/** Project the same visible graph parts used by appearance effects, without changing the scene. */
export function graphHierarchyShapes(source: TextScene | null, camera: THREE.Camera, canvas: HTMLCanvasElement,
  targets: ReadonlyMap<string, boolean>): HighlightShape[] {
  if (!source || !GRAPH_EFFECT_TARGETS.some(target => targets.has(target))) return [];
  const clip = canvas.getBoundingClientRect(), shapes: HighlightShape[] = [];
  if (!clip.width || !clip.height) return shapes;
  camera.updateMatrixWorld();
  const project = (point: THREE.Vector3) => {
    const p = point.clone().project(camera);
    return p.z >= -1 && p.z <= 1 && Number.isFinite(p.x) && Number.isFinite(p.y)
      ? { x: clip.x + (p.x + 1) * clip.width / 2, y: clip.y + (1 - p.y) * clip.height / 2 } : null;
  };
  for (const item of graphEffectItems(source)) {
    const active = targets.get(item.target);
    if (active === undefined || !item.object.visible) continue;
    item.object.updateWorldMatrix(true, true);
    if (item.path) {
      let points: { x: number; y: number }[] = [];
      const push = () => { if (points.length > 1) shapes.push({ points, active, clip }); points = []; };
      for (const world of item.path.getPoints(64)) {
        const point = project(world);
        if (point) points.push(point); else push();
      }
      push();
    } else {
      const mesh = item.object as THREE.Mesh;
      if (mesh.geometry?.type === "PlaneGeometry") {
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox!;
        const points = [[box.min.x, box.min.y], [box.max.x, box.min.y], [box.max.x, box.max.y], [box.min.x, box.max.y]]
          .map(([x, y]) => project(new THREE.Vector3(x, y, 0).applyMatrix4(mesh.matrixWorld)));
        if (points.every(point => point !== null)) shapes.push({ points, active, clip, closed: true });
      } else {
        const box = new THREE.Box3().setFromObject(item.object);
        if (box.isEmpty()) continue;
        const points = [];
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
          const point = project(new THREE.Vector3(x, y, z)); if (point) points.push(point);
        }
        if (!points.length) continue;
        const left = Math.min(...points.map(p => p.x)), top = Math.min(...points.map(p => p.y)),
          right = Math.max(...points.map(p => p.x)), bottom = Math.max(...points.map(p => p.y));
        shapes.push({ active, clip, closed: true, points: [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }] });
      }
    }
  }
  return shapes;
}
