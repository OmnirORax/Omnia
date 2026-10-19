import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Atlas } from "./graph/model";
import { projectSpatial, type XYZ } from "./graph/spatial";
import type { WorkspaceSettings } from "./workspaceActions";
import type { Document } from "./graph/structural";
import { chartedBinders } from "./graph/presentation";
import { occupiedRadii } from "./graph/layout3d";
import { buildTextScene, type TextScene } from "./textScene";
import { NODE_OPTIONS, type projectVariants } from "./graph/variants";
import { nodeClicks } from "./nodeClicks";
import { subtreeGesture } from "./workspaceActions";

export type NavigationCommand = { sequence: number; kind: "focus" | "local" | "variants" | "all" | "hierarchy" | "back" | "cancel"; id?: string };
export type ContextAction = "createChild" | "createAt" | "insertExisting" | "connect" | "toggle" | "focus" | "edit" | "removePlacement" | "removeVariant" | "deleteIdentity" | "compact" | "fitAll" | "settings";
export type ContextTarget = { kind: "node"; id: string } | { kind: "space"; world: XYZ };
type Props = {
  atlas: Atlas;
  document: Document;
  variantDisplay: ReturnType<typeof projectVariants>;
  expandedVariants: ReadonlySet<string>;
  optionNodeId: string | null;
  onToggleVariants: (id: string) => void;
  onAddVariant: (id: string) => void;
  onDismissOptions: () => void;
  selectedId: string | null;
  settings: WorkspaceSettings;
  command: NavigationCommand | null;
  constraintAxis: "x" | "y" | "z" | null;
  onNodeClick: (id: string) => void;
  onNodeDoubleClick: (id: string) => void;
  onSubtreeClick: (id: string) => void;
  onBinderSelect: (id: string, kind: "composition" | "relationship") => void;
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
  const { atlas, selectedId, settings, command, document: doc } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const optionBarRef = useRef<HTMLDivElement>(null);
  const addButtons = useRef(new Map<string, HTMLButtonElement>());
  const stateRef = useRef<SceneState | null>(null);
  const callbacks = useRef(props); callbacks.current = props;
  const baseGraph = projectSpatial(atlas);
  const graph = { ...baseGraph, nodes: [...baseGraph.nodes, ...props.variantDisplay.nodes] };
  const graphRef = useRef(graph); graphRef.current = graph;
  const meshes = useRef<THREE.Sprite[]>([]);
  const groups = useRef(new Map<string, THREE.Group>());
  const textScene = useRef<TextScene | null>(null);
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
        textScene.current?.update(camera, host.clientWidth, host.clientHeight);
        const anchorElement = (element: HTMLElement | undefined | null, id: string, below = false) => {
          if (!element) return;
          const item = textScene.current?.nodes.get(id);
          if (!item || !item.sprite.visible) { element.style.visibility = "hidden"; return; }
          const p = item.group.position.clone().project(camera);
          element.style.visibility = p.z > -1 && p.z < 1 ? "visible" : "hidden";
          element.style.left = `${(p.x + 1) * host.clientWidth / 2}px`;
          const depth = -item.group.position.clone().applyMatrix4(camera.matrixWorldInverse).z;
          const labelHeight = item.sprite.scale.y * host.clientHeight / (2 * Math.max(camera.near, depth) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
          element.style.top = `${(1 - p.y) * host.clientHeight / 2 + (below ? labelHeight / 2 + 10 : 0)}px`;
        };
        anchorElement(optionBarRef.current, callbacks.current.optionNodeId ?? "", true);
        for (const [id, button] of addButtons.current) anchorElement(button, id);
        renderer.render(scene, camera);
      });
    };
    const stopAnimation = () => { if (animation) cancelAnimationFrame(animation); animation = 0; };
    const clicks = nodeClicks((id) => callbacks.current.onNodeClick(id), (id) => callbacks.current.onNodeDoubleClick(id));
    const animate = (target: THREE.Vector3, distance: number, remember = true, facing?: THREE.Vector3) => {
      stopAnimation();
      if (remember) cameraHistory.push({ position: camera.position.clone(), target: controls.target.clone() });
      const fromPosition = camera.position.clone(), fromTarget = controls.target.clone();
      const direction = facing ?? camera.position.clone().sub(controls.target).normalize();
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
      if (kind === "cancel") { clicks.cancel(); stopAnimation(); setMenu(null); setFeedback(""); return; }
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
      if (kind === "all" || kind === "hierarchy" || kind === "variants") {
        const bounds = new THREE.Box3();
        const framing = kind === "variants" ? nodes.filter((n) => n.id === requestedId || callbacks.current.variantDisplay.instances.get(n.id)?.ownerNodeId === requestedId) : nodes;
        if (!framing.length) return;
        for (const node of framing) {
          const center = asVector(node.world), r = callbacks.current.settings.spatial.radius;
          bounds.expandByPoint(center.clone().addScalar(r)); bounds.expandByPoint(center.clone().addScalar(-r));
        }
        const center = bounds.getCenter(new THREE.Vector3());
        animate(center, Math.max(6, bounds.getSize(new THREE.Vector3()).length() * 1.2), true, kind === "hierarchy" ? new THREE.Vector3(0, 0, 1) : undefined); return;
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
      return raycaster.intersectObjects(meshes.current.filter((mesh) => mesh.visible), false).filter((hit) => hit.object.userData.nodeId !== except);
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
    let binderDown: { id: string; kind: "composition" | "relationship"; x: number; y: number } | null = null;
    raycaster.params.Line.threshold = 0.08;
    let hovered: THREE.Sprite | null = null;
    const paintHover = (mesh: THREE.Sprite | null) => {
      if (hovered === mesh) return;
      if (hovered) hovered.material.color.setHex(0xffffff);
      hovered = mesh;
      if (hovered) hovered.material.color.setHex(0xb8dcff);
      renderer.domElement.style.cursor = hovered ? "grab" : "default";
      requestRender();
    };
    const down = (event: PointerEvent) => {
      stopAnimation(); setMenu(null);
      if (event.button === 2) {
        clicks.cancel();
        callbacks.current.onDismissOptions();
        const hit = hits(event)[0]?.object;
        if (callbacks.current.variantDisplay.instances.get(hit?.userData.nodeId)?.kind === "add") return;
        rightDown = { x: event.clientX, y: event.clientY, id: hit?.userData.nodeId ?? null, world: cursorWorld(event) };
        return;
      }
      if (event.button !== 0) return;
      const hit = hits(event)[0];
      if (!hit) {
        clicks.cancel();
        callbacks.current.onDismissOptions();
        const binder = raycaster.intersectObjects(textScene.current?.binderHits.filter((object) => object.visible) ?? [], false)[0]?.object;
        if (binder && ["composition", "relationship"].includes(binder.userData.binderKind)) binderDown = { id: binder.userData.binderId, kind: binder.userData.binderKind, x: event.clientX, y: event.clientY };
        return;
      }
      const id = hit.object.userData.nodeId as string, group = groups.current.get(id); if (!group) return;
      const instance = callbacks.current.variantDisplay.instances.get(id);
      if (instance?.kind === "add") { clicks.cancel(); callbacks.current.onAddVariant(instance.ownerNodeId); return; }
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), group.position);
      const intersection = raycaster.ray.intersectPlane(plane, new THREE.Vector3()); if (!intersection) return;
      const label = textScene.current?.nodes.get(id)?.sprite;
      const marker = new THREE.Mesh(new THREE.PlaneGeometry(label?.scale.x ?? 2, label?.scale.y ?? 0.5), new THREE.MeshBasicMaterial({ color: 0x6cdbdf, wireframe: true, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
      marker.quaternion.copy(camera.quaternion);
      marker.position.copy(group.position); marker.visible = false; scene.add(marker);
      const anchor = asVector(graphRef.current.nodes.find((n) => n.id === id)!.world);
      drag = { id, group, plane, offset: anchor.clone().sub(intersection), startX: event.clientX,
        startY: event.clientY, startWorld: anchor, local: null, nestTarget: null, marker };
      controls.enabled = false; renderer.domElement.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!drag) { if (event.buttons === 0) paintHover((hits(event)[0]?.object as THREE.Sprite) ?? null); return; }
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= CLICK_THRESHOLD) clicks.cancel();
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
        const reason = target ? callbacks.current.canNest(drag.id, target) : "Drop onto a name to nest";
        drag.nestTarget = target && !reason ? target : null;
        drag.local = null;
        drag.marker.visible = Boolean(target);
        if (target) drag.marker.position.copy(groups.current.get(target)!.position);
        (drag.marker.material as THREE.MeshBasicMaterial).color.setHex(reason ? 0xe46868 : 0x6cdbdf);
        setFeedback(target ? reason || `Nest inside ${graphRef.current.nodes.find((n) => n.id === target)?.label}` : "Drop onto a name to nest");
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
        if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < CLICK_THRESHOLD) {
          if (subtreeGesture(event, callbacks.current.settings.mouse.subtreeModifier)) { clicks.cancel(); callbacks.current.onSubtreeClick(current.id); }
          else clicks.click(current.id);
        }
        else if (event.shiftKey && current.nestTarget) callbacks.current.onNest(current.id, current.nestTarget);
        else if (!event.shiftKey && current.local) callbacks.current.onMove(current.id, current.local);
      }
      requestRender();
    };
    const up = (event: PointerEvent) => {
      if (event.button === 0 && binderDown) {
        const b = binderDown; binderDown = null;
        if (Math.hypot(event.clientX - b.x, event.clientY - b.y) < CLICK_THRESHOLD) callbacks.current.onBinderSelect(b.id, b.kind);
      }
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
    const cancel = (event: PointerEvent) => { clicks.cancel(); finishDrag(event, true); };
    const preventMenu = (event: MouseEvent) => event.preventDefault();
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", cancel);
    renderer.domElement.addEventListener("contextmenu", preventMenu);
    setReady(true);
    return () => {
      clicks.cancel(); stopAnimation(); cancelAnimationFrame(pendingRender);
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
    disposeContent(state.content);
    const visible = graph.nodes.filter((n) => n.visible);
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const binders = [...chartedBinders(doc), ...props.variantDisplay.binders].flatMap((b) => {
      const from = byId.get(b.source), to = byId.get(b.target);
      if (!from || !to || (from.representative === to.representative && (!from.visible || !to.visible))) return [];
      return [{ ...b, source: from.representative, target: to.representative }];
    });
    const built = buildTextScene(state.content, visible, binders, doc, selectedId);
    textScene.current = built;
    meshes.current = built.nodeHits;
    groups.current = new Map([...built.nodes].map(([id, node]) => [id, node.group]));
    volumeRadii.current = occupiedRadii(doc, settings.spatial);
    state.requestRender();
    if (!firstFocus.current && visible.length) {
      firstFocus.current = true;
      state.focus("local", visible.find((n) => n.parentId === null)?.id ?? visible[0].id);
    }
  }, [atlas, doc, selectedId, ready, settings.spatial.radius, settings.spatial.clearance, props.variantDisplay]);

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
  const variantMenu: [ContextAction, string][] = [["focus", "Focus"], ["edit", "Rename / edit in inspector"], ["removeVariant", "Remove variant from owner"], ["deleteIdentity", "Delete identity…"]];
  const menuItems = menu?.target.kind === "node" ? props.variantDisplay.instances.get(menu.target.id)?.kind === "variant" ? variantMenu : nodeMenu : spaceMenu;
  return <div className="spatial-workspace" aria-label="3D Omnium workspace" ref={hostRef}>
    {error && <div className="spatial-error" role="alert">{error}</div>}
    <div className="spatial-help">Click: options / variants · double-click: expand / collapse · {settings.mouse.subtreeModifier !== "none" && `${settings.mouse.subtreeModifier}-click: entire subtree · `}Shift-drag: nest · right-drag: rotate</div>
    {props.optionNodeId && <div ref={optionBarRef} className="node-options" role="toolbar" aria-label="Node options">
      {NODE_OPTIONS.map((option) => <button key={option.id} aria-expanded={props.expandedVariants.has(props.optionNodeId!)} onClick={() => props.onToggleVariants(props.optionNodeId!)}>{option.label}</button>)}
    </div>}
    {[...props.variantDisplay.instances].filter(([, item]) => item.kind === "add").map(([id, item]) => <button key={id} className="variant-add" ref={(element) => { if (element) addButtons.current.set(id, element); else addButtons.current.delete(id); }} aria-label={`Add variant for ${graph.nodes.find((n) => n.id === item.ownerNodeId)?.label || "node"}`} onContextMenu={(event) => event.preventDefault()} onClick={() => props.onAddVariant(item.ownerNodeId)}>+</button>)}
    <div className="spatial-controls">
      <button onClick={() => stateRef.current?.focus("focus", selectedId ?? undefined)} disabled={!selectedId}>Focus selected</button>
      <button onClick={() => stateRef.current?.focus("local", selectedId ?? undefined)}>Fit local system</button>
      <button onClick={() => stateRef.current?.focus("all")}>Fit entire atlas</button>
      <button onClick={() => stateRef.current?.focus("back")}>Back</button>
    </div>
    {feedback && <div className="spatial-feedback" role="status">{feedback}</div>}
    {menu && <div className="spatial-menu" role="menu" style={{ left: Math.max(0, menu.x), top: Math.max(0, menu.y) }}>
      {menuItems.map(([action, label]) =>
        <button key={action} role="menuitem" onClick={() => { callbacks.current.onContextAction(action, menu.target); setMenu(null); }}>{label}</button>)}
    </div>}
  </div>;
}
