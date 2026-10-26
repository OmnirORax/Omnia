import { RENDER_BUDGET } from "./renderBudget";
import { structuralVisual, omnicAsset, omnicBudgetAsset, OMNIC_SCENE_BUDGET } from "./omnic/presentation";
import { brightHex } from "./appearance/resolve";
import { connected } from "./appearance/model";
import { TARGETS } from "./appearance/registry";
import * as THREE from "three";
import { canvasFont, type FontId } from "./fonts";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { arrowLength, binderGap, operatorSize } from "./graph/binderGeometry";
import { labelLines, labelSize } from "./graph/labels";
import type { DisplayBinder } from "./graph/presentation";
import type { SpatialNode } from "./graph/spatial";
import { visualObject } from "./visualScene";
import type { Document } from "./graph/structural";
import { DEFAULT_SPHERE_DIAMETER, visualFootprint } from "./graph/assets";
import { resolveAppearance } from "./graph/appearance";
import { defaultSettings, type WorkspaceSettings } from "./workspaceActions";

const glyphColor = (theme: WorkspaceSettings['appearance'], id: string, fallback: string) => {
 const v = theme.renderDefaults?.[id]; return v ? brightHex(v.color as string, v.brightness as number) : theme.textColor ?? fallback;
};
const glyphGlow = (theme: WorkspaceSettings['appearance'], id: string) => Number(theme.renderDefaults?.[id]?.glow ?? theme.textGlow);
const glyphFont = (theme: WorkspaceSettings['appearance'], id: string) => (theme.renderDefaults?.[id]?.font ?? theme.font) as FontId;
type SurfaceStyle={background?:string;contour?:string;opacity?:number;contourOpacity?:number;backgroundGlow?:number;contourGlow?:number};
const customized=(theme:WorkspaceSettings['appearance'],id:string)=>!!theme.controller&&(!!theme.controller.values[id]||!connected(theme.controller,[...TARGETS],id,'color'));
const surfaceStyle = (theme: WorkspaceSettings['appearance'], id: string, authored?: string):SurfaceStyle => {
 const v=theme.renderDefaults?.[id],contour=theme.renderDefaults?.['omnium.nodes.contour'];
 return {
  background:customized(theme,id)&&v?brightHex(v.color as string,Number(v.brightness)):undefined,
  opacity:customized(theme,id)&&v?Number(v.opacity):undefined,
  backgroundGlow:customized(theme,id)&&v?Number(v.glow):undefined,
  contour:authored??(id==='omnium.nodes.background'&&customized(theme,'omnium.nodes.contour')&&contour?brightHex(contour.color as string,Number(contour.brightness)):undefined),
  contourOpacity:id==='omnium.nodes.background'&&customized(theme,'omnium.nodes.contour')?Number(contour?.opacity):undefined,
  contourGlow:id==='omnium.nodes.background'&&customized(theme,'omnium.nodes.contour')?Number(contour?.glow):undefined,
 };
};
const symbolStyle=(theme:WorkspaceSettings['appearance'],id:string,authored:string|undefined,fallback:string)=>{
 const v=theme.renderDefaults?.[id];return {color:authored??(v&&customized(theme,id)?brightHex(v.color as string,Number(v.brightness)):fallback),opacity:Number(v?.opacity??1),brightness:Number(v?.brightness??1),glow:Number(v?.glow??0)};
};
export type LabelMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial | THREE.MeshPhongMaterial>;

export function textSprite(value: string, color: string, selected = false, node = false, neon = false, font: FontId = "system", textGlow = 0, textColor = color, surface: SurfaceStyle = {}) {
  const lines = labelLines(value),
    canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d")!;
  measure.font = canvasFont(font);
  canvas.width = Math.ceil(
    Math.max(100, ...lines.map((line) => measure.measureText(line).width)) + 36,
  );
  canvas.height = lines.length * 48 + 20;
  const ctx = canvas.getContext("2d")!;
  const paint = (border: string, ink: string, glow: number) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.shadowBlur = 0;
    if (node) {
      ctx.fillStyle = surface.background ?? (neon ? selected ? "#063c50ed" : "#041923cc" : selected ? "#203b59" : "#101e2deb");
      ctx.beginPath();
      ctx.roundRect(1, 1, canvas.width - 2, canvas.height - 2, 12);
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = (surface.backgroundGlow ?? 0) * 10;
      ctx.globalAlpha = surface.opacity ?? 1; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = surface.contour ?? (selected ? neon ? "#69efff" : "#b9dcff" : border);
      ctx.lineWidth = selected ? 3 : 1;
      ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=(surface.contourGlow??0)*10;
      ctx.globalAlpha = surface.contourOpacity ?? (selected ? 1 : 0.35);
      ctx.stroke();
      ctx.globalAlpha = 1;

    } else {
      ctx.fillStyle = surface.background ?? (neon ? "#04121bd9" : "#101927ee");
      ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=(surface.backgroundGlow??0)*10;
      ctx.globalAlpha = surface.opacity ?? 1;
      ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1;
    }
    ctx.font = canvasFont(font);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ink;
    ctx.shadowColor = ink; ctx.shadowBlur = glow * 10;
    lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, 10 + 24 + i * 48));
  };
  paint(color, textColor, textGlow);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Small text should not blend progressively blurrier mip levels while zooming.
  // One bilinear sample keeps antialiasing without extra texture allocations/passes.
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
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
  sprite.userData.lightningMask = () => {
    const mask = document.createElement("canvas"); mask.width = canvas.width; mask.height = canvas.height;
    const ink = mask.getContext("2d")!; ink.font = canvasFont(font);
    ink.textAlign = "center"; ink.textBaseline = "middle"; ink.fillStyle = "white";
    lines.forEach((line, i) => ink.fillText(line, mask.width / 2, 10 + 24 + i * 48));
    return mask;
  };
  let currentStyle: [string, string, number] = [color, textColor, textGlow];
  let surfaceKey = JSON.stringify(surface);
  sprite.userData.setSurfaceStyle = (next: typeof surface) => {
    const key = JSON.stringify(next); if (key === surfaceKey) return;
    surfaceKey = key; surface = next; paint(...currentStyle); texture.needsUpdate = true;
  };
  sprite.userData.setSelected = (value: boolean) => {
    if (value === selected) return;
    selected = value; paint(...currentStyle); texture.needsUpdate = true;
  };
  let paintKey = JSON.stringify([color, textColor, textGlow]);
  sprite.userData.setTextStyle = (border: string, ink: string, glow: number) => {
    const next = JSON.stringify([border, ink, glow]);
    if (next === paintKey) return;
    paintKey = next; currentStyle = [border, ink, glow]; paint(border, ink, glow); texture.needsUpdate = true;
    sprite.userData.textColor = ink;
  };
  sprite.userData.label = value;
  sprite.userData.textColor = textColor;
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
export type ColorPreview = { kind: "node" | "binder" | "binderText"; id: string; color: string };
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
  sphereDiameter = DEFAULT_SPHERE_DIAMETER,
) {
  const neon = theme.theme === "neon", accent = theme.accent;
  const nodes = new Map<string, NodeItem>();
  const placements = new Map(doc.placements.map(p => [p.id, p]));
  const nodeHits: LabelMesh[] = [],
    binderHits: (THREE.Line | THREE.Mesh | THREE.Sprite)[] = [];
  let omnicPreviews = 0;
  for (const node of visible) {
    const placement = placements.get(node.id);
    const appearance = placement?.appearance;
    let displayedVisual = placement ? structuralVisual(doc, placement) : undefined;
    let derivedAsset: import("./graph/assets").VisualAsset | undefined;
    if (displayedVisual?.assetId?.startsWith("omnic:")) {
      derivedAsset = omnicPreviews++ < OMNIC_SCENE_BUDGET ? omnicAsset(doc, placement!.entityId) : omnicBudgetAsset;
      if (derivedAsset) displayedVisual = {...displayedVisual,assetId:derivedAsset.id};
    }
    const style = resolveAppearance(theme.nodes, neon ? accent : "#dce9fa", appearance);
    style.opacity *= theme.opacity;
    const group = new THREE.Group();
    if (placement?.orientation) group.quaternion.set(placement.orientation.x, placement.orientation.y, placement.orientation.z, placement.orientation.w);
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
      glyphFont(theme, 'text.nodes'),
      glyphGlow(theme, 'text.nodes'),
      appearance?.color ?? glyphColor(theme, 'text.nodes', color),
    );
    text.material.opacity = style.opacity;
    const hasVisual = !!(displayedVisual?.assetId || displayedVisual?.character);
    const footprint = visualFootprint(labelSize(node.label), displayedVisual, sphereDiameter);
    const visual = hasVisual ? visualObject(displayedVisual!, derivedAsset ? [derivedAsset] : doc.assets ?? [], (value) => textSprite(value, color, false, false, neon, theme.font, theme.textGlow, theme.textColor), requestRender, { opacity: style.opacity }, derivedAsset ? RENDER_BUDGET.omnicTextureEdge : 512) : undefined;
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
    // Labels remain node targets when a sphere or visual proxy is the main body.
    // Rotated text can visibly extend beyond that body's picking volume.
    if (text !== sprite) {
      text.userData.nodeId = node.id;
      text.userData.baseColor = text.material.color.clone();
      text.userData.hoverOutline = outline;
      nodeHits.push(text);
    }
    nodes.set(node.id, {
      group,
      sprite,
      anchor: group.position.clone(),
      size: labelSize(node.label),
      text, visual, visualSize: displayedVisual?.size ?? (hasVisual ? 1.4 : sphereDiameter), showText: !!node.label.trim() && displayedVisual?.showText !== false,
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
    const textStyle = { ...resolveAppearance(theme.nodes, neon ? accent : "#dce9fa", b.textAppearance), ...(theme.textColor ? { color: theme.textColor } : {}) };
    style.opacity *= theme.opacity; textStyle.opacity *= theme.opacity;
    const color = style.color;
    const related = !selectedId || b.source === selectedId || b.target === selectedId;
    const opacity = style.opacity;
    const material = new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: Number(theme.renderDefaults?.["omnium.binders.path"]?.contourWidth ?? 1.5), worldUnits: false, alphaToCoverage: true, transparent: true, depthWrite: false, opacity, dashed: b.kind === "visual" || b.kind === "variant", dashSize: 0.15, gapSize: 0.1 });
    const line = new Line2(new LineGeometry(), material);
    line.userData.glowIntensity = style.glow;
    const defaultArrow = new THREE.Mesh(
      new THREE.ConeGeometry(1, 1, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
    );
    const custom = !!(b.visual?.assetId || b.visual?.character);
    const arrow = custom ? visualObject(b.visual!, doc.assets ?? [], (value) => textSprite(value, color, false, false, neon, theme.font, theme.textGlow, theme.textColor), requestRender, { opacity }) : defaultArrow;
    arrow.userData.glowIntensity = style.glow;
    if (custom) { defaultArrow.geometry.dispose(); defaultArrow.material.dispose(); }
    const markerHit = custom ? new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })) : undefined;
    const label = b.label && b.visual?.showText !== false ? textSprite(b.label, textStyle.color, false, false, neon, glyphFont(theme, 'text.binders'), glyphGlow(theme, 'text.binders'), b.textAppearance?.color ?? glyphColor(theme, 'text.binders', textStyle.color)) : null;
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
  let currentTheme = theme, currentPreview: ColorPreview | null | undefined;
  function applyTheme(next: WorkspaceSettings["appearance"], preview?: ColorPreview | null) {
    currentTheme = next; currentPreview = preview;
    const fallback = next.theme === "neon" ? next.accent : "#dce9fa";
    for (const [id, item] of nodes) {
      const placement = placements.get(id);
      const override = preview?.kind === "node" && preview.id === id ? { opacity: next.nodes.opacity, ...placement?.appearance, color: preview.color } : placement?.appearance;
      const style = resolveAppearance(next.nodes, fallback, override);
      item.color = style.color; item.opacity = style.opacity * next.opacity;
      item.group.userData.glowIntensity = style.glow;
      item.text.userData.setTextStyle(style.color, override?.color ?? glyphColor(next, 'text.nodes', style.color), override?.glow ?? glyphGlow(next, 'text.nodes'));
      item.text.userData.setSurfaceStyle(surfaceStyle(next, 'omnium.nodes.background', override?.color));
      item.text.material.opacity = item.opacity * Number(next.renderDefaults?.['text.nodes']?.opacity ?? 1);
      const ring=symbolStyle(next,'omnium.selection',override?.color,style.color);
      item.outline.material.color.set(ring.color);item.outline.userData.opacity=ring.opacity;item.outline.userData.glowIntensity=ring.glow;
      item.text.userData.glowIntensity=override?.glow??(next.controller?.values['text.nodes']?.glow!==undefined?glyphGlow(next,'text.nodes'):style.glow);
      if (item.sphere) {
        item.sprite.material.color.set(style.color); item.sprite.material.opacity = item.opacity;
        item.sprite.userData.baseColor = item.sprite.material.color.clone();
        item.sprite.userData.baseOpacity = item.opacity;
      }
      const symbol=symbolStyle(next,'symbols.nodes',override?.color,style.color);
      if(item.visual)item.visual.userData.glowIntensity=override?.glow??symbol.glow;
      item.visual?.userData.setAppearance?.({ opacity: item.opacity*symbol.opacity, brightness:symbol.brightness, textColor:symbol.color, textGlow:override?.glow??symbol.glow });
    }
    for (const item of connectors) applyConnectorTheme(item, next, preview);
  }
  function applyConnectorTheme(item: BinderItem, next: WorkspaceSettings["appearance"], preview?: ColorPreview | null) {
      const fallback = next.theme === "neon" ? next.accent : "#dce9fa";
      const original = item.data;
      const b = preview?.id === original.id ? {
        ...original,
        ...(preview.kind === "binder" ? { color: preview.color } : {}),
        ...(preview.kind === "binderText" ? { textAppearance: { opacity: next.nodes.opacity, ...original.textAppearance, color: preview.color } } : {}),
      } : original;
      const style = resolveAppearance(next.binders, next.theme === "neon" ? next.accent : b.kind === "relationship" ? "#9fc4e9" : b.kind === "composition" ? "#83c9c1" : "#7d8c9e", b.color ? { color: b.color, opacity: b.opacity ?? next.binders.opacity, glow: b.glow } : undefined);
      const text = resolveAppearance(next.nodes, fallback, b.textAppearance);
      item.opacity = style.opacity * next.opacity; item.textOpacity = (b.textAppearance?.opacity ?? Number(next.renderDefaults?.['text.binders']?.opacity ?? text.opacity)) * next.opacity;
      item.line.material.linewidth = Number(next.renderDefaults?.["omnium.binders.path"]?.contourWidth ?? 1.5);
      item.line.material.color.set(style.color); item.line.userData.glowIntensity = style.glow;
      const operator=symbolStyle(next,'symbols.binders',b.color,style.color);
      item.arrow.userData.glowIntensity = b.glow??operator.glow;
      const fade = item.related ? 1 : 0.28;
      item.line.material.opacity = item.opacity * fade;
      item.arrow.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Sprite)
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.opacity = item.opacity * fade * operator.opacity;
      });
      if (item.arrow instanceof THREE.Mesh) (item.arrow.material as THREE.MeshBasicMaterial).color.set(operator.color);
      item.arrow.userData.setAppearance?.({ opacity: item.opacity * fade * operator.opacity, brightness:operator.brightness, textColor:operator.color, textGlow:b.glow??operator.glow });
      item.label?.userData.setTextStyle(text.color, b.textAppearance?.color ?? glyphColor(next, 'text.binders', text.color), b.textAppearance?.glow ?? glyphGlow(next, 'text.binders'));
      item.label?.userData.setSurfaceStyle(surfaceStyle(next, 'omnium.binders.background'));
      if (item.label) { item.label.userData.glowIntensity = b.textAppearance?.glow??(next.controller?.values['text.binders']?.glow!==undefined?glyphGlow(next,'text.binders'):text.glow); item.label.material.opacity = item.textOpacity; }
  }
  function updateSelection(primary: string | null, selected: ReadonlySet<string>) {
    for (const [id,item] of nodes) {
      const next = primary === id || selected.has(id);
      if (item.selected === next) continue;
      item.selected = next; item.outline.userData.selected = next; item.outline.visible = next;
      item.text.userData.setSelected(next);
    }
    for (const item of connectors) {
      const related = !primary || item.data.source === primary || item.data.target === primary;
      if (related === item.related) continue;
      item.related = related; applyConnectorTheme(item, currentTheme, currentPreview);
    }
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
      } else { const length = arrowLength(b.data.visual); b.arrow.scale.set(length / 3, length, length / 3); }
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
      ring.quaternion.copy(item.group.quaternion).invert().multiply(camera.quaternion);
      ring.scale.setScalar(radius * (item.selected ? 1 + pulse * 0.1 : 1));
      ring.material.opacity = item.opacity * Number(ring.userData.opacity??1) * (item.selected ? 0.45 + pulse * 0.4 : 0.45);
    }
  }
  applyTheme(theme);
  return { nodes, connectors, nodeHits, binderHits, update, animateSelection, applyTheme, updateSelection };
}
