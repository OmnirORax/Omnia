import * as THREE from "three";
import { labelLines, labelSize, separateLabels, type ScreenLabel } from "./graph/labels";
import type { DisplayBinder } from "./graph/presentation";
import type { SpatialNode } from "./graph/spatial";
import { visualObject } from "./visualScene";
import type { Document } from "./graph/structural";

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
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    }),
  );
  sprite.userData.label = value;
  sprite.userData.aspect = canvas.width / canvas.height;
  sprite.userData.lines = lines.length;
  return sprite;
}
type NodeItem = {
  group: THREE.Group;
  sprite: THREE.Sprite;
  anchor: THREE.Vector3;
  size: { width: number; height: number };
  text: THREE.Sprite;
  visual?: THREE.Group;
  visualSize: number;
  showText: boolean;
};
type BinderItem = {
  data: DisplayBinder;
  line: THREE.Line;
  arrow: THREE.Mesh | THREE.Group;
  markerHit?: THREE.Sprite;
  label: THREE.Sprite | null;
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
  const nodeHits: THREE.Sprite[] = [],
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
    const sprite = hasVisual ? new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x9fc4e9, transparent: true, opacity: selectedId === node.id || selectedIds.has(node.id) ? 0.15 : 0, depthWrite: false, depthTest: false })) : text;
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
    const markerHit = custom ? new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthWrite: false })) : undefined;
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
  function update(camera: THREE.PerspectiveCamera, width: number, height: number) {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const depth = (point: THREE.Vector3) =>
      -point.clone().applyMatrix4(camera.matrixWorldInverse).z;
    const unitsPerPixel = (point: THREE.Vector3) =>
      Math.max(
        0.0001,
        (2 *
          Math.max(camera.near, depth(point)) *
          Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) /
          height,
      );
    const rects: ScreenLabel[] = [];
    const toScreen = (point: THREE.Vector3) => {
      const p = point.clone().project(camera);
      return { x: ((p.x + 1) * width) / 2, y: ((1 - p.y) * height) / 2 };
    };
    const scaleText = (sprite: THREE.Sprite, point: THREE.Vector3, font: number) => {
      const h = unitsPerPixel(point) * (font * 1.33 * sprite.userData.lines + 10);
      sprite.scale.set(h * sprite.userData.aspect, h, 1);
    };
    const ordered = [...nodes].sort(
      ([a], [b]) => Number(b === selectedId) - Number(a === selectedId) || a.localeCompare(b),
    );
    for (const [id, item] of ordered) {
      item.group.position.copy(item.anchor);
      scaleText(item.text, item.anchor, 18);
      item.text.visible = item.showText;
      if (item.visual) {
        const size = unitsPerPixel(item.anchor) * 38 * item.visualSize;
        const textHeight = item.showText ? item.text.scale.y + unitsPerPixel(item.anchor) * 8 : 0;
        item.visual.scale.setScalar(size);
        item.visual.position.copy(up).multiplyScalar(textHeight / 2);
        item.text.position.copy(up).multiplyScalar(-size / 2);
        item.sprite.scale.set(Math.max(size, item.showText ? item.text.scale.x : 0), size + textHeight, 1);
      }
      item.sprite.visible = depth(item.anchor) > camera.near;
      if (!item.sprite.visible) continue;
      const pixels = unitsPerPixel(item.anchor);
      rects.push({
        id,
        ...toScreen(item.anchor),
        width: item.sprite.scale.x / pixels,
        height: item.sprite.scale.y / pixels,
      });
    }
    const shifts = separateLabels(rects);
    for (const [id, item] of nodes)
      item.group.position.addScaledVector(
        right,
        (shifts.get(id) ?? 0) * unitsPerPixel(item.anchor),
      );
    // Reserve only the space the actual binder annotation needs. Display offsets do not
    // rewrite authored coordinates, and the selected anchor stays under camera focus.
    for (const b of connectors) {
      if (!b.label || b.data.source === b.data.target) continue;
      const from = nodes.get(b.data.source)!, to = nodes.get(b.data.target)!;
      const mid = from.group.position.clone().lerp(to.group.position, 0.5);
      scaleText(b.label, mid, 14);
      const a = toScreen(from.group.position), z = toScreen(to.group.position);
      const dx = z.x - a.x, dy = z.y - a.y, length = Math.hypot(dx, dy);
      if (length < 1e-4) continue;
      const ux = dx / length, uy = dy / length, pixel = unitsPerPixel(mid);
      const projectedSize = (sprite: THREE.Sprite) => (Math.abs(ux) * sprite.scale.x + Math.abs(uy) * sprite.scale.y) / pixel;
      const required = (projectedSize(from.sprite) + projectedSize(to.sprite)) / 2 + projectedSize(b.label) + 28;
      const extra = Math.max(0, required - length);
      if (extra) {
        const preserveTarget = b.data.target === selectedId;
        const item = preserveTarget ? from : to, sign = preserveTarget ? -1 : 1;
        item.group.position.addScaledVector(right, ux * extra * pixel * sign).addScaledVector(up, -uy * extra * pixel * sign);
      }
    }
    const occupied = rects.map((r) => ({ ...r, ...toScreen(nodes.get(r.id)!.group.position) }));
    const finalShifts = separateLabels(occupied);
    for (const [id, item] of nodes) item.group.position.addScaledVector(right, (finalShifts.get(id) ?? 0) * unitsPerPixel(item.group.position));
    for (const r of occupied) r.x += finalShifts.get(r.id) ?? 0;
    const edge = (item: NodeItem, other: THREE.Vector3) => {
      const direction = other.clone().sub(item.group.position);
      const x = Math.abs(direction.dot(right)),
        y = Math.abs(direction.dot(up));
      const fraction = Math.min(
        x > 1e-5 ? item.sprite.scale.x / 2 / x : Infinity,
        y > 1e-5 ? item.sprite.scale.y / 2 / y : Infinity,
      );
      return item.group.position
        .clone()
        .addScaledVector(direction, Number.isFinite(fraction) ? Math.min(0.45, fraction) : 0);
    };
    const operatorRects: ScreenLabel[] = [];
    for (const b of connectors) {
      const from = nodes.get(b.data.source)!,
        to = nodes.get(b.data.target)!;
      const start = edge(from, to.group.position),
        end = edge(to, from.group.position);
      const mid = start
        .clone()
        .lerp(end, 0.5)
        .addScaledVector(right, b.spread * 0.65);
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
      const center = path.getPoint(0.5),
        tangent = path.getTangent(0.5).normalize();
      const pixel = unitsPerPixel(center);
      const markerSize = pixel * 22 * (b.data.visual?.size ?? 1.4);
      if (b.markerHit) { b.arrow.scale.setScalar(markerSize); b.markerHit.scale.set(markerSize, markerSize, 1); b.markerHit.position.copy(center); }
      else b.arrow.scale.set(pixel * 5, pixel * 13, pixel * 5);
      b.arrow.position.copy(center);
      if (!b.markerHit) b.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      const fade = b.related ? 1 : 0.28;
      (b.line.material as THREE.LineBasicMaterial).opacity = b.opacity * fade;
      b.arrow.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) for (const material of Array.isArray(object.material) ? object.material : [object.material]) { material.transparent = true; material.opacity = b.opacity * fade; }
      });
      if (b.label) {
        scaleText(b.label, center, 14);
        const separation =
          b.data.kind === "relationship"
            ? b.label.scale.y / 2 +
              Math.max(from.sprite.scale.y, to.sprite.scale.y) / 2 +
              pixel * 12
            : pixel * 26;
        b.label.position.copy(center).addScaledVector(up, separation);
        b.label.material.opacity = b.opacity;
        b.label.visible = b.related && depth(b.label.position) > camera.near;
        if (b.label.visible)
          operatorRects.push({
            id: `binder:${b.data.key}`,
            ...toScreen(b.label.position),
            width: b.label.scale.x / pixel,
            height: b.label.scale.y / pixel,
          });
      }
    }
    const allOffsets = separateLabels([...occupied, ...operatorRects]);
    for (const b of connectors)
      if (b.label?.visible)
        b.label.position.addScaledVector(
          right,
          (allOffsets.get(`binder:${b.data.key}`) ?? 0) * unitsPerPixel(b.label.position),
        );
    content.updateMatrixWorld(true);
  }
  return { nodes, nodeHits, binderHits, update };
}
