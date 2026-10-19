import * as THREE from "three";
import { labelLines, labelSize } from "./graph/labels";
import type { DisplayBinder } from "./graph/presentation";
import type { SpatialNode } from "./graph/spatial";
import { visualObject } from "./visualScene";
import type { Document } from "./graph/structural";
import { visualFootprint } from "./graph/assets";

export type LabelMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

export function textSprite(value: string, color: string, selected = false, node = false) {
  const lines = labelLines(value),
    canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d")!;
  measure.font = "500 36px system-ui, sans-serif";
  canvas.width = Math.ceil(
    Math.max(100, ...lines.map((line) => measure.measureText(line).width)) + 36,
  );
  canvas.height = lines.length * 48 + 20;
  const ctx = canvas.getContext("2d")!;
  if (node) {
    ctx.fillStyle = selected ? "#203b59" : "#101e2deb";
    ctx.beginPath();
    ctx.roundRect(1, 1, canvas.width - 2, canvas.height - 2, 12);
    ctx.fill();
    ctx.strokeStyle = selected ? "#b9dcff" : color;
    ctx.lineWidth = selected ? 3 : 1;
    ctx.globalAlpha = selected ? 1 : 0.35;
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = "#101927ee";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.font = "500 36px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, 10 + 24 + i * 48));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    }),
  );
  sprite.userData.label = value;
  sprite.userData.aspect = canvas.width / canvas.height;
  sprite.userData.lines = lines.length;
  const size = labelSize(value);
  sprite.scale.set(size.width, size.height, 1);
  return sprite;
}
type NodeItem = {
  group: THREE.Group;
  sprite: LabelMesh;
  anchor: THREE.Vector3;
  size: { width: number; height: number };
  text: LabelMesh;
  visual?: THREE.Group;
  visualSize: number;
  showText: boolean;
  depth: number;
};
type BinderItem = {
  data: DisplayBinder;
  line: THREE.Line;
  arrow: THREE.Mesh | THREE.Group;
  markerHit?: LabelMesh;
  label: LabelMesh | null;
  opacity: number;
  related: boolean;
  spread: number;
};
export type TextScene = ReturnType<typeof buildTextScene>;
export function buildTextScene(
  content: THREE.Group,
  visible: SpatialNode[],
  binders: DisplayBinder[],
  doc: Document,
  selectedId: string | null,
  requestRender: () => void = () => {},
  selectedIds: ReadonlySet<string> = new Set(),
) {
  const nodes = new Map<string, NodeItem>();
  const nodeHits: LabelMesh[] = [],
    binderHits: (THREE.Line | THREE.Mesh | THREE.Sprite)[] = [];
  for (const node of visible) {
    const placement = doc.placements.find((p) => p.id === node.id);
    const appearance = placement?.appearance;
    const group = new THREE.Group();
    group.position.set(node.world.x, node.world.y, node.world.z);
    const text = textSprite(
      node.label,
      appearance?.color ?? "#dce9fa",
      selectedId === node.id || selectedIds.has(node.id),
      true,
    );
    text.material.opacity = appearance?.opacity ?? 1;
    const hasVisual = !!(placement?.visual?.assetId || placement?.visual?.character);
    const visual = hasVisual ? visualObject(placement!.visual!, doc.assets ?? [], (value) => textSprite(value, appearance?.color ?? "#dce9fa"), requestRender) : undefined;
    const sprite = hasVisual ? new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x9fc4e9, transparent: true, opacity: selectedId === node.id || selectedIds.has(node.id) ? 0.15 : 0, depthWrite: false, side: THREE.DoubleSide })) : text;
    sprite.userData.nodeId = node.id;
    sprite.userData.visualProxy = hasVisual;
    sprite.userData.baseOpacity = sprite.material.opacity;
    group.add(sprite);
    if (hasVisual) group.add(text, visual!);
    content.add(group);
    nodeHits.push(sprite);
    nodes.set(node.id, {
      group,
      sprite,
      anchor: group.position.clone(),
      size: labelSize(node.label),
      text, visual, visualSize: placement?.visual?.size ?? 1.4, showText: !hasVisual || placement?.visual?.showText !== false,
      depth: doc.assets?.find(a => a.id === placement?.visual?.assetId)?.kind === "glb" ? placement?.visual?.size ?? 1.4 : 0.05,
    });
  }
  const totals = new Map<string, number>(),
    indices = new Map<string, number>();
  const pair = (b: DisplayBinder) => [b.source, b.target].sort().join("\u0000");
  for (const b of binders) totals.set(pair(b), (totals.get(pair(b)) ?? 0) + 1);
  const connectors: BinderItem[] = [];
  for (const b of binders) {
    if (!nodes.has(b.source) || !nodes.has(b.target)) continue;
    const color =
      b.color ??
      (b.kind === "relationship" ? "#9fc4e9" : b.kind === "composition" ? "#83c9c1" : "#7d8c9e");
    const related = !selectedId || b.source === selectedId || b.target === selectedId;
    const opacity = b.opacity ?? 0.85;
    const material =
      b.kind === "visual" || b.kind === "variant"
        ? new THREE.LineDashedMaterial({
            color,
            dashSize: 0.15,
            gapSize: 0.1,
            transparent: true,
            depthWrite: false,
            opacity,
          })
        : new THREE.LineBasicMaterial({ color, transparent: true, depthWrite: false, opacity });
    const line = new THREE.Line(new THREE.BufferGeometry(), material);
    const defaultArrow = new THREE.Mesh(
      new THREE.ConeGeometry(1, 1, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
    );
    const custom = !!(b.visual?.assetId || b.visual?.character);
    const arrow = custom ? visualObject(b.visual!, doc.assets ?? [], (value) => textSprite(value, color), requestRender) : defaultArrow;
    if (custom) { defaultArrow.geometry.dispose(); defaultArrow.material.dispose(); }
    const markerHit = custom ? new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })) : undefined;
    const label = b.label && b.visual?.showText !== false ? textSprite(b.label, color) : null;
    for (const object of [line, ...(custom ? [markerHit!] : [defaultArrow]), ...(label ? [label] : [])]) {
      object.userData.binderId = b.id;
      object.userData.binderKind = b.kind;
      object.userData.label = b.label;
      content.add(object);
      binderHits.push(object);
    }
    if (custom) content.add(arrow);
    const index = indices.get(pair(b)) ?? 0;
    indices.set(pair(b), index + 1);
    connectors.push({
      data: b,
      line,
      arrow,
      markerHit,
      label,
      opacity,
      related,
      spread: index - ((totals.get(pair(b)) ?? 1) - 1) / 2,
    });
  }
  function update(camera: THREE.PerspectiveCamera, _width: number, height: number) {
    const right = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3(0, 1, 0);
    const depth = (point: THREE.Vector3) => -point.clone().applyMatrix4(camera.matrixWorldInverse).z;
    const unitsPerPixel = (point: THREE.Vector3) =>
      2 * Math.max(camera.near, depth(point)) * Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV() / 2)) / Math.max(1, height);
    // Camera changes must never relocate nodes or keep their screen size constant.
    // Flat visuals live in the world XY plane, alongside ordinary 3D assets.
    for (const item of nodes.values()) {
      item.group.position.copy(item.anchor);
      item.text.scale.set(item.size.width, item.size.height, 1);
      const front = depth(item.anchor) > camera.near;
      item.text.visible = item.showText && front;
      if (item.visual) {
        const textHeight = item.showText ? item.size.height : 0, gap = item.showText ? 0.3 : 0;
        item.visual.scale.setScalar(item.visualSize);
        item.visual.position.set(0, (textHeight + gap) / 2, 0);
        item.visual.visible = front;
        item.text.position.set(0, -(item.visualSize + gap) / 2, 0);
        const footprint = visualFootprint(item.size, { character: "visual", size: item.visualSize, showText: item.showText });
        item.sprite.scale.set(footprint.width, footprint.height, item.depth);
      }
      item.sprite.visible = front;
    }
    const edge = (item: NodeItem, other: THREE.Vector3) => {
      const direction = other.clone().sub(item.group.position);
      const half = { x: item.sprite.scale.x / 2, y: item.sprite.scale.y / 2, z: item.depth / 2 };
      let fraction = Infinity;
      for (const axis of ["x", "y", "z"] as const)
        if (Math.abs(direction[axis]) > 1e-8) fraction = Math.min(fraction, half[axis] / Math.abs(direction[axis]));
      return item.group.position.clone().addScaledVector(direction, Number.isFinite(fraction) ? Math.min(0.45, fraction) : 0);
    };
    for (const b of connectors) {
      const from = nodes.get(b.data.source)!, to = nodes.get(b.data.target)!;
      const start = edge(from, to.group.position), end = edge(to, from.group.position);
      const direction = end.clone().sub(start).normalize();
      const perpendicular = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 0, 1));
      if (perpendicular.lengthSq() < 1e-8) perpendicular.set(1, 0, 0);
      perpendicular.normalize();
      const mid = start.clone().lerp(end, 0.5).addScaledVector(perpendicular, b.spread * 0.65);
      let path: THREE.Curve<THREE.Vector3>;
      if (from === to) {
        const r = Math.max(from.sprite.scale.x, from.sprite.scale.y);
        path = new THREE.CatmullRomCurve3([
          start.clone().addScaledVector(right, r / 2),
          start.clone().addScaledVector(right, r).addScaledVector(up, r),
          start.clone().addScaledVector(up, r * 1.5),
          start.clone().addScaledVector(right, -r).addScaledVector(up, r),
          end.clone().addScaledVector(right, -r / 2),
        ]);
      } else path = new THREE.QuadraticBezierCurve3(start, mid, end);
      const old = b.line.geometry;
      b.line.geometry = new THREE.BufferGeometry().setFromPoints(path.getPoints(32));
      old.dispose();
      if (b.data.kind === "visual" || b.data.kind === "variant") b.line.computeLineDistances();
      const center = path.getPoint(0.5), tangent = path.getTangent(0.5).normalize();
      const markerSize = 0.45 * (b.data.visual?.size ?? 1.4);
      if (b.markerHit) {
        b.arrow.scale.setScalar(markerSize);
        b.markerHit.scale.set(markerSize, markerSize, 1);
        b.markerHit.position.copy(center);
      } else b.arrow.scale.set(0.08, 0.24, 0.08);
      b.arrow.position.copy(center);
      if (!b.markerHit) b.arrow.quaternion.setFromUnitVectors(up, tangent);
      const fade = b.related ? 1 : 0.28;
      (b.line.material as THREE.LineBasicMaterial).opacity = b.opacity * fade;
      b.arrow.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Sprite)
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            material.transparent = true; material.opacity = b.opacity * fade;
          }
      });
      if (b.label) {
        const size = labelSize(b.data.label);
        b.label.scale.set(size.width * 0.7, size.height * 0.7, 1);
        b.label.position.copy(center).addScaledVector(up, b.label.scale.y / 2 + 0.22);
        b.label.material.opacity = b.opacity;
        b.label.visible = b.related && depth(b.label.position) > camera.near && b.label.scale.y / unitsPerPixel(b.label.position) >= 5;
      }
    }
    content.updateMatrixWorld(true);
  }
  return { nodes, nodeHits, binderHits, update };
}
