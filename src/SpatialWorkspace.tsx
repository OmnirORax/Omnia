import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Atlas } from "./graph/model";
import { projectSpatial, type XYZ } from "./graph/spatial";
import type { WorkspaceSettings } from "./workspaceActions";

export type NavigationCommand = { sequence: number; kind: "focus" | "local" | "all" | "back" | "cancel"; id?: string };
export type ContextAction = "createChild" | "createAt" | "insertExisting" | "connect" | "toggle" | "focus" | "edit" | "removePlacement" | "deleteIdentity" | "compact" | "fitAll" | "settings";
export type ContextTarget = { kind: "node"; id: string } | { kind: "space"; world: XYZ };
type Props = {
  atlas: Atlas;
  selectedId: string | null;
  settings: WorkspaceSettings;
  command: NavigationCommand | null;
  constraintAxis: "x" | "y" | "z" | null;
  onNodeClick: (id: string) => void;
  onMove: (id: string, local: XYZ) => void;
  resolveMove: (id: string, local: XYZ) => XYZ;
  canNest: (id: string, targetId: string) => string | null;
  onNest: (id: string, targetId: string) => void;
  onContextAction: (action: ContextAction, target: ContextTarget) => void;
};
type CameraPose = { position: THREE.Vector3; target: THREE.Vector3 };
type SceneState = {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  renderer: THREE.WebGLRenderer;
  content: THREE.Group;
  requestRender: () => void;
  focus: (kind: NavigationCommand["kind"], id?: string) => void;
};
type Menu = { x: number; y: number; target: ContextTarget };
const CLICK_THRESHOLD = 5;
const MOVE_DURATION = 380;
const asVector = (p: XYZ) => new THREE.Vector3(p.x, p.y, p.z);
const asXYZ = (p: THREE.Vector3): XYZ => ({ x: p.x, y: p.y, z: p.z });

function labelSprite(value: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 128;
  const context = canvas.getContext("2d")!;
  context.font = "600 38px system-ui, sans-serif";
  context.fillStyle = color; context.textAlign = "center"; context.textBaseline = "middle";
  let label = value || "Untitled";
  while (context.measureText(label).width > 470 && label.length > 2) label = `${label.slice(0, -2)}…`;
  context.fillText(label, 256, 64);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: true }));
  sprite.scale.set(2.15, 0.54, 1);
  return sprite;
}
function disposeContent(group: THREE.Group) {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite) {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) { if (material instanceof THREE.SpriteMaterial) material.map?.dispose(); material.dispose(); }
    }
  });
  group.clear();
}

export default function SpatialWorkspace(props: Props) {
  const { atlas, selectedId, settings, command } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SceneState | null>(null);
  const callbacks = useRef(props); callbacks.current = props;
  const graph = projectSpatial(atlas);
  const graphRef = useRef(graph); graphRef.current = graph;
  const meshes = useRef<THREE.Mesh[]>([]);
  const groups = useRef(new Map<string, THREE.Group>());
  const labels = useRef<{ sprite: THREE.Sprite; point: THREE.Vector3; selected: boolean }[]>([]);
  const volumeRadii = useRef(new Map<string, number>());
  const firstFocus = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState<Menu | null>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
    catch { setError("3D rendering is unavailable in this browser."); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x101927);
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101927);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 100000);
    camera.position.set(7, 5, 9);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false; controls.enablePan = true;
    controls.minDistance = 1.2; controls.maxDistance = 100000;
    const content = new THREE.Group(); scene.add(content);
    scene.add(new THREE.AmbientLight(0xffffff, 2.1));
    const light = new THREE.DirectionalLight(0xffffff, 2.2); light.position.set(5, 12, 9); scene.add(light);
    let pendingRender = 0, animation = 0;
    const cameraHistory: CameraPose[] = [];
    const requestRender = () => {
      if (pendingRender) return;
      pendingRender = requestAnimationFrame(() => {
        pendingRender = 0;
        content.updateMatrixWorld(true);
        const occupied: { x: number; y: number }[] = [];
        const ordered = labels.current.map((item) => ({ item, distance: camera.position.distanceTo(item.point) }))
          .sort((a, b) => Number(b.item.selected) - Number(a.item.selected) || a.distance - b.distance);
        for (const { item, distance } of ordered) {
          if (!item.selected && distance >= 32) { item.sprite.visible = false; continue; }
          const projected = item.sprite.getWorldPosition(new THREE.Vector3()).project(camera);
          const x = (projected.x + 1) * renderer.domElement.width / 2;
          const y = (1 - projected.y) * renderer.domElement.height / 2;
          const overlaps = occupied.some((other) => Math.abs(other.x - x) < 115 && Math.abs(other.y - y) < 26);
          item.sprite.visible = item.selected || !overlaps;
          if (item.sprite.visible) occupied.push({ x, y });
        }
        renderer.render(scene, camera);
      });
    };
    const stopAnimation = () => { if (animation) cancelAnimationFrame(animation); animation = 0; };
    const animate = (target: THREE.Vector3, distance: number, remember = true) => {
      stopAnimation();
      if (remember) cameraHistory.push({ position: camera.position.clone(), target: controls.target.clone() });
      const fromPosition = camera.position.clone(), fromTarget = controls.target.clone();
      const direction = camera.position.clone().sub(controls.target).normalize();
      if (direction.lengthSq() < 0.001) direction.set(1, 0.7, 1).normalize();
      const toPosition = target.clone().addScaledVector(direction, Math.max(2.8, distance));
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / MOVE_DURATION);
        const eased = 1 - Math.pow(1 - t, 3);
        camera.position.copy(fromPosition).lerp(toPosition, eased);
        controls.target.copy(fromTarget).lerp(target, eased);
        controls.update(); requestRender();
        if (t < 1) animation = requestAnimationFrame(tick); else animation = 0;
      };
      animation = requestAnimationFrame(tick);
    };
    const focus = (kind: NavigationCommand["kind"], requestedId?: string) => {
      if (kind === "cancel") { stopAnimation(); setMenu(null); setFeedback(""); return; }
      if (kind === "back") {
        const pose = cameraHistory.pop(); if (!pose) return;
        stopAnimation();
        const fromPosition = camera.position.clone(), fromTarget = controls.target.clone();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / MOVE_DURATION), eased = 1 - Math.pow(1 - t, 3);
          camera.position.copy(fromPosition).lerp(pose.position, eased);
          controls.target.copy(fromTarget).lerp(pose.target, eased);
          controls.update(); requestRender();
          if (t < 1) animation = requestAnimationFrame(tick); else animation = 0;
        };
        animation = requestAnimationFrame(tick); return;
      }
      const nodes = graphRef.current.nodes.filter((n) => n.visible);
      if (!nodes.length) return;
      if (kind === "all") {
        const bounds = new THREE.Box3();
        for (const node of nodes) {
          const center = asVector(node.world), r = callbacks.current.settings.spatial.radius;
          bounds.expandByPoint(center.clone().addScalar(r)); bounds.expandByPoint(center.clone().addScalar(-r));
        }
        const center = bounds.getCenter(new THREE.Vector3());
        animate(center, Math.max(6, bounds.getSize(new THREE.Vector3()).length() * 1.2)); return;
      }
      const node = nodes.find((n) => n.id === requestedId) ?? nodes.find((n) => n.parentId === null) ?? nodes[0];
      const point = asVector(node.world);
      let radius = callbacks.current.settings.spatial.radius;
      if (kind === "local") {
        const children = nodes.filter((n) => n.parentId === node.id);
        for (const child of children) radius = Math.max(radius, point.distanceTo(asVector(child.world)) + (volumeRadii.current.get(child.id) ?? radius));
      } else radius = volumeRadii.current.get(node.id) ?? radius;
      const fov = THREE.MathUtils.degToRad(camera.fov);
      animate(point, Math.max(4, radius / Math.tan(fov / 2) * 1.5));
    };
    stateRef.current = { camera, controls, renderer, content, requestRender, focus };
    const resize = () => {
      camera.aspect = Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight);
      camera.updateProjectionMatrix(); renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight), false); requestRender();
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    controls.addEventListener("change", requestRender);
    controls.addEventListener("start", stopAnimation);
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const aim = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
    };
    const hits = (event: PointerEvent, except?: string) => {
      aim(event);
      return raycaster.intersectObjects(meshes.current, false).filter((hit) => hit.object.userData.nodeId !== except);
    };
    const cursorWorld = (event: PointerEvent) => {
      aim(event);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), controls.target);
      return asXYZ(raycaster.ray.intersectPlane(plane, new THREE.Vector3()) ?? controls.target);
    };
    let drag: { id: string; group: THREE.Group; plane: THREE.Plane; offset: THREE.Vector3;
      startX: number; startY: number; startWorld: THREE.Vector3; local: XYZ | null; nestTarget: string | null;
      marker: THREE.Mesh; } | null = null;
    let rightDown: { x: number; y: number; id: string | null; world: XYZ } | null = null;
    let hovered: THREE.Mesh | null = null;
    const paintHover = (mesh: THREE.Mesh | null) => {
      if (hovered === mesh) return;
      if (hovered) (hovered.material as THREE.MeshStandardMaterial).emissive.setHex(hovered.userData.nodeId === callbacks.current.selectedId ? 0x204a7a : 0x000000);
      hovered = mesh;
      if (hovered) (hovered.material as THREE.MeshStandardMaterial).emissive.setHex(0x386ea8);
      renderer.domElement.style.cursor = hovered ? "grab" : "default";
      requestRender();
    };
    const down = (event: PointerEvent) => {
      stopAnimation(); setMenu(null);
      if (event.button === 2) {
        rightDown = { x: event.clientX, y: event.clientY, id: hits(event)[0]?.object.userData.nodeId ?? null, world: cursorWorld(event) };
        return;
      }
      if (event.button !== 0) return;
      const hit = hits(event)[0]; if (!hit) return;
      const id = hit.object.userData.nodeId as string, group = groups.current.get(id); if (!group) return;
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), group.position);
      const intersection = raycaster.ray.intersectPlane(plane, new THREE.Vector3()); if (!intersection) return;
      const radius = volumeRadii.current.get(id) ?? callbacks.current.settings.spatial.radius;
      const marker = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 12), new THREE.MeshBasicMaterial({ color: 0x6cdbdf, wireframe: true, transparent: true, opacity: 0.5, depthWrite: false }));
      marker.position.copy(group.position); marker.visible = false; scene.add(marker);
      drag = { id, group, plane, offset: group.position.clone().sub(intersection), startX: event.clientX,
        startY: event.clientY, startWorld: group.position.clone(), local: null, nestTarget: null, marker };
      controls.enabled = false; renderer.domElement.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!drag) { if (event.buttons === 0) paintHover((hits(event)[0]?.object as THREE.Mesh) ?? null); return; }
      aim(event);
      const intersection = raycaster.ray.intersectPlane(drag.plane, new THREE.Vector3()); if (!intersection) return;
      const wanted = intersection.add(drag.offset);
      const axis = callbacks.current.constraintAxis;
      if (axis) for (const other of ["x", "y", "z"] as const) if (other !== axis) wanted[other] = drag.startWorld[other];
      const node = graphRef.current.nodes.find((n) => n.id === drag!.id)!;
      const parent = graphRef.current.nodes.find((n) => n.id === node.parentId);
      const parentWorld = parent ? asVector(parent.world) : new THREE.Vector3();
      if (event.shiftKey) {
        const target = hits(event, drag.id)[0]?.object.userData.nodeId as string | undefined;
        const reason = target ? callbacks.current.canNest(drag.id, target) : "Drop onto a sphere to nest";
        drag.nestTarget = target && !reason ? target : null;
        drag.local = null;
        drag.marker.visible = Boolean(target);
        if (target) drag.marker.position.copy(groups.current.get(target)!.position);
        (drag.marker.material as THREE.MeshBasicMaterial).color.setHex(reason ? 0xe46868 : 0x6cdbdf);
        setFeedback(target ? reason || `Nest inside ${graphRef.current.nodes.find((n) => n.id === target)?.label}` : "Drop onto a sphere to nest");
      } else {
        drag.nestTarget = null;
        try {
          const local = callbacks.current.resolveMove(drag.id, asXYZ(wanted.clone().sub(parentWorld)));
          drag.local = local;
          drag.marker.position.copy(parentWorld).add(asVector(local)); drag.marker.visible = true;
          (drag.marker.material as THREE.MeshBasicMaterial).color.setHex(0x6cdbdf);
          setFeedback(`Target: ${local.x.toFixed(2)}, ${local.y.toFixed(2)}, ${local.z.toFixed(2)}${axis ? ` · ${axis.toUpperCase()} only` : ""}`);
        } catch (error) {
          drag.local = null; drag.marker.position.copy(wanted); drag.marker.visible = true;
          (drag.marker.material as THREE.MeshBasicMaterial).color.setHex(0xe46868);
          setFeedback(error instanceof Error ? error.message : String(error));
        }
      }
      requestRender();
    };
    const finishDrag = (event: PointerEvent, cancelled = false) => {
      if (!drag) return;
      const current = drag; drag = null;
      controls.enabled = true;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      scene.remove(current.marker); current.marker.geometry.dispose(); (current.marker.material as THREE.Material).dispose();
      setFeedback("");
      if (!cancelled) {
        if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < CLICK_THRESHOLD) callbacks.current.onNodeClick(current.id);
        else if (event.shiftKey && current.nestTarget) callbacks.current.onNest(current.id, current.nestTarget);
        else if (!event.shiftKey && current.local) callbacks.current.onMove(current.id, current.local);
      }
      requestRender();
    };
    const up = (event: PointerEvent) => {
      if (event.button === 2 && rightDown) {
        const right = rightDown; rightDown = null;
        if (Math.hypot(event.clientX - right.x, event.clientY - right.y) < CLICK_THRESHOLD) {
          const rect = host.getBoundingClientRect();
          setMenu({ x: Math.min(event.clientX - rect.left, rect.width - 215), y: Math.min(event.clientY - rect.top, rect.height - 360),
            target: right.id ? { kind: "node", id: right.id } : { kind: "space", world: right.world } });
        }
      }
      if (event.button === 0) finishDrag(event);
    };
    const cancel = (event: PointerEvent) => finishDrag(event, true);
    const preventMenu = (event: MouseEvent) => event.preventDefault();
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", cancel);
    renderer.domElement.addEventListener("contextmenu", preventMenu);
    setReady(true);
    return () => {
      stopAnimation(); cancelAnimationFrame(pendingRender);
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointercancel", cancel);
      renderer.domElement.removeEventListener("contextmenu", preventMenu);
      observer.disconnect(); controls.dispose(); disposeContent(content); renderer.dispose(); renderer.domElement.remove(); stateRef.current = null;
    };
  }, []);

  useEffect(() => {
    const state = stateRef.current; if (!state || !ready) return;
    const button = (action: "pan" | "rotate" | "none") => action === "pan" ? THREE.MOUSE.PAN : action === "rotate" ? THREE.MOUSE.ROTATE : null;
    state.controls.mouseButtons = { LEFT: button(settings.mouse.leftEmpty), MIDDLE: THREE.MOUSE.DOLLY, RIGHT: button(settings.mouse.rightEmpty) };
  }, [ready, settings.mouse.leftEmpty, settings.mouse.rightEmpty]);

  useEffect(() => {
    const state = stateRef.current; if (!state || !ready) return;
    disposeContent(state.content); meshes.current = []; groups.current = new Map(); labels.current = [];
    const visible = graph.nodes.filter((n) => n.visible);
    const byId = new Map(visible.map((n) => [n.id, n]));
    const radii = new Map<string, number>();
    const radiusFor = (id: string): number => {
      const cached = radii.get(id); if (cached !== undefined) return cached;
      const parent = byId.get(id)!;
      let radius = settings.spatial.radius;
      if (!parent.collapsed) for (const child of visible.filter((n) => n.parentId === id))
        radius = Math.max(radius, asVector(parent.world).distanceTo(asVector(child.world)) + radiusFor(child.id) + settings.spatial.clearance);
      radii.set(id, radius); return radius;
    };
    for (const node of visible) radiusFor(node.id);
    volumeRadii.current = radii;
    for (const node of visible) {
      const group = new THREE.Group(); group.position.copy(asVector(node.world));
      const selected = selectedId === node.id;
      const material = new THREE.MeshStandardMaterial({ color: selected ? 0x5c91de : 0x3a6390,
        emissive: selected ? 0x204a7a : 0x000000, roughness: 0.42, metalness: 0.08 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(settings.spatial.radius, 32, 24), material);
      mesh.userData.nodeId = node.id; group.add(mesh);
      const label = labelSprite(node.label, selected ? "#ffffff" : "#dce9fa");
      label.position.y = settings.spatial.radius + 0.39; group.add(label);
      labels.current.push({ sprite: label, point: group.position, selected });
      state.content.add(group); meshes.current.push(mesh); groups.current.set(node.id, group);
    }
    for (const node of visible) {
      const r = radii.get(node.id)!;
      if (node.collapsed || r <= settings.spatial.radius + 0.01) continue;
      const boundary = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20),
        new THREE.MeshBasicMaterial({ color: selectedId === node.id ? 0x7ac7d7 : 0x6b9bd7,
          transparent: true, opacity: 0.055, depthWrite: false, side: THREE.BackSide }));
      boundary.position.copy(asVector(node.world)); state.content.add(boundary);
    }
    const pairTotals = new Map<string, number>(), pairIndex = new Map<string, number>();
    const pairKey = (a: string, b: string) => [a, b].sort().join("\u0000");
    for (const relationship of graph.relationships) {
      const key = pairKey(relationship.source, relationship.target);
      pairTotals.set(key, (pairTotals.get(key) ?? 0) + 1);
    }
    for (const relationship of graph.relationships) {
      const from = byId.get(relationship.source), to = byId.get(relationship.target);
      if (!from || !to) continue;
      const fromPoint = asVector(from.world), toPoint = asVector(to.world);
      const direction = toPoint.clone().sub(fromPoint), length = direction.length();
      const radius = settings.spatial.radius;
      const related = !selectedId || relationship.source === selectedId || relationship.target === selectedId;
      const color = !related ? 0x516076 : relationship.projected ? 0xe0a86c : 0x9fc4e9;
      const key = pairKey(relationship.source, relationship.target);
      const index = pairIndex.get(key) ?? 0; pairIndex.set(key, index + 1);
      const spread = index - ((pairTotals.get(key) ?? 1) - 1) / 2;
      let points: THREE.Vector3[];
      if (length < 0.01) {
        const loop = radius * (1.9 + Math.abs(spread) * 0.4);
        const path = new THREE.CatmullRomCurve3([
          fromPoint.clone().add(new THREE.Vector3(radius, 0, 0)),
          fromPoint.clone().add(new THREE.Vector3(loop, loop, 0.3 + spread * 0.4)),
          fromPoint.clone().add(new THREE.Vector3(0, loop * 1.7, 0.3 + spread * 0.4)),
          fromPoint.clone().add(new THREE.Vector3(-loop, loop, 0.3 + spread * 0.4)),
          fromPoint.clone().add(new THREE.Vector3(-radius, 0, 0)),
        ]);
        points = path.getPoints(32);
      } else {
        direction.normalize();
        const start = fromPoint.clone().addScaledVector(direction, radius);
        const end = toPoint.clone().addScaledVector(direction, -radius);
        const lateral = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0));
        if (lateral.lengthSq() < 0.01) lateral.set(1, 0, 0);
        lateral.normalize().multiplyScalar(spread * 0.6);
        const mid = start.clone().add(end).multiplyScalar(0.5).add(lateral);
        points = new THREE.QuadraticBezierCurve3(start, mid, end).getPoints(24);
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity: related ? 0.85 : 0.16, depthWrite: false }));
      state.content.add(line);
      const end = points.at(-1)!;
      const tangent = end.clone().sub(points.at(-3)!).normalize();
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: related ? 0.85 : 0.16, depthWrite: false }));
      cone.position.copy(end).addScaledVector(tangent, -0.16);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      state.content.add(cone);
      if (relationship.label && related) {
        const label = labelSprite(relationship.label, "#f2c58f");
        label.scale.set(1.48, 0.37, 1);
        label.position.copy(points[Math.floor(points.length / 2)]).add(new THREE.Vector3(0, 0.34, 0));
        state.content.add(label);
        labels.current.push({ sprite: label, point: label.position, selected: false });
      }
    }
    state.requestRender();
    if (!firstFocus.current && visible.length) {
      firstFocus.current = true;
      state.focus("local", visible.find((n) => n.parentId === null)?.id ?? visible[0].id);
    }
  }, [atlas, selectedId, ready, settings.spatial.radius, settings.spatial.clearance]);

  useEffect(() => { if (command) stateRef.current?.focus(command.kind, command.id); }, [command]);
  const nodeMenu: [ContextAction, string][] = [
    ["createChild", "Create child"], ["insertExisting", "Insert existing entity"], ["connect", "Connect to another node"],
    ["toggle", "Expand / collapse"], ["focus", "Focus"], ["edit", "Rename / edit in inspector"],
    ["removePlacement", "Remove placement"], ["deleteIdentity", "Delete identity…"],
  ];
  const spaceMenu: [ContextAction, string][] = [
    ["createAt", "Create node here"], ["insertExisting", "Insert existing entity"],
    ["compact", "Compact layout"], ["fitAll", "Fit entire atlas"], ["settings", "Workspace settings"],
  ];
  return <div className="spatial-workspace" aria-label="3D Omnium workspace" ref={hostRef}>
    {error && <div className="spatial-error" role="alert">{error}</div>}
    <div className="spatial-help">Left-drag space: pan · right-drag: rotate · scroll: zoom · drag sphere: move · Shift-drag onto sphere: nest</div>
    <div className="spatial-controls">
      <button onClick={() => stateRef.current?.focus("focus", selectedId ?? undefined)} disabled={!selectedId}>Focus selected</button>
      <button onClick={() => stateRef.current?.focus("local", selectedId ?? undefined)}>Fit local system</button>
      <button onClick={() => stateRef.current?.focus("all")}>Fit entire atlas</button>
      <button onClick={() => stateRef.current?.focus("back")}>Back</button>
    </div>
    {feedback && <div className="spatial-feedback" role="status">{feedback}</div>}
    {menu && <div className="spatial-menu" role="menu" style={{ left: Math.max(0, menu.x), top: Math.max(0, menu.y) }}>
      {(menu.target.kind === "node" ? nodeMenu : spaceMenu).map(([action, label]) =>
        <button key={action} role="menuitem" onClick={() => { callbacks.current.onContextAction(action, menu.target); setMenu(null); }}>{label}</button>)}
    </div>}
  </div>;
}
