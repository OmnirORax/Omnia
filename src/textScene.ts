import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { ARROW_LENGTH, binderGap, operatorSize } from "./graph/binderGeometry";
import { labelLines, labelSize } from "./graph/labels";
import type { DisplayBinder } from "./graph/presentation";
import type { SpatialNode } from "./graph/spatial";
import { visualObject } from "./visualScene";
import type { Document } from "./graph/structural";
import { visualFootprint } from "./graph/assets";
import { resolveAppearance } from "./graph/appearance";
import { defaultSettings, type WorkspaceSettings } from "./workspaceActions";

export type LabelMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial | THREE.MeshPhongMaterial>;

export function textSprite(value: string, color: string, selected = false, node = false, neon = false) {
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
    ctx.fillStyle = neon ? selected ? "#063c50ed" : "#041923cc" : selected ? "#203b59" : "#101e2deb";
    ctx.beginPath();
    ctx.roundRect(1, 1, canvas.width - 2, canvas.height - 2, 12);
    ctx.fill();
    ctx.strokeStyle = selected ? neon ? "#69efff" : "#b9dcff" : color;
    ctx.lineWidth = selected ? 3 : 1;
    ctx.globalAlpha = selected ? 1 : 0.35;
    ctx.stroke();
    ctx.globalAlpha = 1;

  } else {
    ctx.fillStyle = neon ? "#04121bd9" : "#101927ee";
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
  sphere: boolean;
  color: string;
  opacity: number;
  outline: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  selected: boolean;
};
type BinderItem = {
  data: DisplayBinder;
  line: Line2;
  arrow: THREE.Mesh | THREE.Group;
  markerHit?: LabelMesh;
  label: LabelMesh | null;
  opacity: number;
  textOpacity: number;
  related: boolean;
  spread: number;
  path?: THREE.Curve<THREE.Vector3>;
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
  theme: WorkspaceSettings["appearance"] = defaultSettings().appearance,
) {
  const neon = theme.theme === "neon", accent = theme.accent;
  const nodes = new Map<string, NodeItem>();
  const nodeHits: LabelMesh[] = [],
    binderHits: (THREE.Line | THREE.Mesh | THREE.Sprite)[] = [];
  for (const node of visible) {
    const placement = doc.placements.find((p) => p.id === node.id);
    const appearance = placement?.appearance;
    const style = resolveAppearance(theme.nodes, neon ? accent : "#dce9fa", appearance);
    style.opacity *= theme.opacity;
    const group = new THREE.Group();
    group.userData.glowIntensity = style.glow;
    group.position.set(node.world.x, node.world.y, node.world.z);
    const selected = selectedId === node.id || selectedIds.has(node.id);
    const color = style.color;
    const text = textSprite(
      node.label,
      color,
      selected,
      true,
      neon,
    );
    text.material.opacity = style.opacity;
    const hasVisual = !!(placement?.visual?.assetId || placement?.visual?.character);
    const svgIcon = doc.assets?.find(asset => asset.id === placement?.visual?.assetId)?.dataUrl.startsWith("data:image/svg+xml");
    const footprint = visualFootprint(labelSize(node.label), placement?.visual);
    const visual = hasVisual ? visualObject(placement!.visual!, doc.assets ?? [], (value) => textSprite(value, color), requestRender, { color: appearance?.color ?? theme.nodes.color ?? (svgIcon ? color : undefined), opacity: style.opacity }) : undefined;
    const sprite: LabelMesh = footprint.sphere
      ? new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), new THREE.MeshPhongMaterial({ color, shininess: 35, transparent: true, opacity: style.opacity }))
      : hasVisual ? new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })) : text;
    // Picking volumes remain fully invisible, even while hovered or selected.
    const outline = new THREE.Mesh(
      new THREE.RingGeometry(0.96, 1, 96),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false, depthTest: false, side: THREE.DoubleSide }),
    );
    outline.visible = selected; outline.userData.selected = selected;
    outline.renderOrder = 20;
    sprite.userData.hoverOutline = outline;
    group.add(outline);
    sprite.userData.nodeId = node.id;
    sprite.userData.visualProxy = hasVisual;
    sprite.userData.baseOpacity = sprite.material.opacity;
    sprite.userData.baseColor = sprite.material.color.clone();
    group.add(sprite);
    if (sprite !== text) group.add(text);
    if (visual) group.add(visual);
    content.add(group);
    nodeHits.push(sprite);
    nodes.set(node.id, {
      group,
      sprite,
      anchor: group.position.clone(),
      size: labelSize(node.label),
      text, visual, visualSize: placement?.visual?.size ?? (hasVisual ? 1.4 : 1), showText: !!node.label.trim() && placement?.visual?.showText !== false,
      depth: doc.assets?.find(a => a.id === placement?.visual?.assetId)?.kind === "glb" ? placement?.visual?.size ?? 1.4 : 0.05,
      sphere: footprint.sphere, outline, selected, color: style.color, opacity: style.opacity,
    });
  }
  const totals = new Map<string, number>(),
    indices = new Map<string, number>();
  const pair = (b: DisplayBinder) => [b.source, b.target].sort().join("\u0000");
  for (const b of binders) totals.set(pair(b), (totals.get(pair(b)) ?? 0) + 1);
  const connectors: BinderItem[] = [];
  for (const b of binders) {
    if (!nodes.has(b.source) || !nodes.has(b.target)) continue;
    const style = resolveAppearance(theme.binders, neon ? accent : b.kind === "relationship" ? "#9fc4e9" : b.kind === "composition" ? "#83c9c1" : "#7d8c9e", b.color ? { color: b.color, opacity: b.opacity ?? theme.binders.opacity, glow: b.glow } : undefined);
    const textStyle = resolveAppearance(theme.nodes, neon ? accent : "#dce9fa", b.textAppearance);
    style.opacity *= theme.opacity; textStyle.opacity *= theme.opacity;
    const color = style.color;
    const related = !selectedId || b.source === selectedId || b.target === selectedId;
    const opacity = style.opacity;
    const material = new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: 1.5, worldUnits: false, alphaToCoverage: true, transparent: true, depthWrite: false, opacity, dashed: b.kind === "visual" || b.kind === "variant", dashSize: 0.15, gapSize: 0.1 });
    const line = new Line2(new LineGeometry(), material);
    line.userData.glowIntensity = style.glow;
    const defaultArrow = new THREE.Mesh(
      new THREE.ConeGeometry(1, 1, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
    );
    const custom = !!(b.visual?.assetId || b.visual?.character);
    const svgIcon = doc.assets?.find(asset => asset.id === b.visual?.assetId)?.dataUrl.startsWith("data:image/svg+xml");
    const arrow = custom ? visualObject(b.visual!, doc.assets ?? [], (value) => textSprite(value, color), requestRender, { color: b.color ?? theme.binders.color ?? (svgIcon ? color : undefined), opacity }) : defaultArrow;
    arrow.userData.glowIntensity = style.glow;
    if (custom) { defaultArrow.geometry.dispose(); defaultArrow.material.dispose(); }
    const markerHit = custom ? new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })) : undefined;
    const label = b.label && b.visual?.showText !== false ? textSprite(b.label, textStyle.color, false, false, neon) : null;
    if (label) label.userData.glowIntensity = textStyle.glow;
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
      textOpacity: textStyle.opacity,
      related,
      spread: index - ((totals.get(pair(b)) ?? 1) - 1) / 2,
    });
  }
  function update(camera: THREE.PerspectiveCamera, width: number, height: number) {
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
      if (item.sphere) { item.sprite.scale.setScalar(item.visualSize); }
      // Text and its picking surface are the same object for text-only nodes.
      if (item.sprite !== item.text) item.sprite.visible = front;
    }
    const edge = (item: NodeItem, other: THREE.Vector3) => {
      const direction = other.clone().sub(item.group.position);
      if (item.sphere) return item.group.position.clone().addScaledVector(direction.clone().normalize(), item.visualSize / 2);
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
        const r = Math.max(from.sprite.scale.x, from.sprite.scale.y, binderGap(b.data));
        path = new THREE.CatmullRomCurve3([
          start.clone().addScaledVector(right, r / 2),
          start.clone().addScaledVector(right, r).addScaledVector(up, r),
          start.clone().addScaledVector(up, r * 1.5),
          start.clone().addScaledVector(right, -r).addScaledVector(up, r),
          end.clone().addScaledVector(right, -r / 2),
        ]);
      } else path = new THREE.QuadraticBezierCurve3(start, mid, end);
      b.path = path;
      const old = b.line.geometry;
      b.line.geometry = new LineGeometry().setPositions(path.getPoints(48).flatMap(p => [p.x, p.y, p.z]));
      b.line.material.resolution.set(width, height);
      old.dispose();
      if (b.data.kind === "visual" || b.data.kind === "variant") b.line.computeLineDistances();
      const center = path.getPoint(0.5), tangent = path.getTangent(0.5).normalize();
      const markerSize = operatorSize(b.data.visual);
      if (b.markerHit) {
        b.arrow.scale.setScalar(markerSize);
        b.markerHit.scale.set(markerSize, markerSize, 1);
        b.markerHit.position.copy(center);
      } else b.arrow.scale.set(0.08, ARROW_LENGTH, 0.08);
      b.arrow.position.copy(center);
      if (!b.markerHit) b.arrow.quaternion.setFromUnitVectors(up, tangent);
      const fade = b.related ? 1 : 0.28;
      b.line.material.opacity = b.opacity * fade;
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
        b.label.material.opacity = b.textOpacity;
        b.label.visible = b.related && depth(b.label.position) > camera.near && b.label.scale.y / unitsPerPixel(b.label.position) >= 5;
      }
    }
    content.updateMatrixWorld(true);
  }
  function animateSelection(camera: THREE.PerspectiveCamera, seconds: number, animate: boolean) {
    const pulse = animate ? (Math.sin(seconds * Math.PI * 1.5) + 1) / 2 : 0.5;
    for (const item of nodes.values()) {
      const ring = item.outline;
      if (!ring.visible) continue;
      const footprint = item.sprite.scale;
      const radius = Math.max(0.65, Math.hypot(footprint.x, footprint.y) / 2 + 0.12);
      // Screen-facing interaction overlay; the represented structure keeps its world orientation.
      ring.quaternion.copy(camera.quaternion);
      ring.scale.setScalar(radius * (item.selected ? 1 + pulse * 0.1 : 1));
      ring.material.opacity = item.opacity * (item.selected ? 0.45 + pulse * 0.4 : 0.45);
    }
  }
  return { nodes, connectors, nodeHits, binderHits, update, animateSelection };
}
