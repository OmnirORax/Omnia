import { isNudgeAction, type NudgeActionId } from "./workspaceActions";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { guardCameraPointer } from "./cameraPointer";
import type { Atlas } from "./graph/model";
import { isolateSpatialContext, projectSpatial, type XYZ } from "./graph/spatial";
import { disposeVisual } from "./visualScene";
import type { ActionId, WorkspaceSettings } from "./workspaceActions";
import type { Document } from "./graph/structural";
import { chartedBinders } from "./graph/presentation";
import { occupiedRadii, worldPositions } from "./graph/layout3d";
import { buildTextScene, type LabelMesh, type ColorPreview, type TextScene } from "./textScene";
import { CameraGuide, DEFAULT_CAMERA_FOV, DEFAULT_CAMERA_POSITION, updateCameraGuide } from "./CameraGuide";
import { createSceneAppearance } from "./sceneAppearance";
import { labelSize } from "./graph/labels";
import { visualFootprint } from "./graph/assets";
import { NODE_OPTIONS, type projectVariants } from "./graph/variants";
import { nodeClicks } from "./nodeClicks";
import { subtreeGesture } from "./workspaceActions";
import { EntityMenu } from "./ui/EntityMenu";
import { FunctionControl } from "./ui/UIWorkspace";
import { normalizeFont, isCustomFont } from "./fonts";
import { loadFont } from "./fontLibrary";
import { registerHierarchyScene, type SceneSelectionPaint } from "./appearance/sceneFeedback";
import { createGraphHierarchyPulse } from "./appearance/graphHighlight";

export type NavigationCommand = { sequence: number; kind: NudgeActionId | "focus" | "selection" | "local" | "variants" | "all" | "hierarchy" | "back" | "cancel" | "zoom100" | "cameraOrigin" | "rollLeft" | "rollRight"; id?: string };
export type ContextAction = "createUIFrame" | "expand" | "collapse" | "createChild" | "createAt" | "insertExisting" | "connect" | "toggle" | "focus" | "edit" | "removePlacement" | "deleteIdentity" | "compact" | "fitAll" | "settings";
export type ContextTarget = { kind: "selection"; ids: string[] } | { kind: "node"; id: string } | { kind: "space"; world: XYZ; screen?: { x: number; y: number } };
type Props = {
  colorPreview?: ColorPreview | null;
  atlas: Atlas;
  document: Document;
  variantDisplay: ReturnType<typeof projectVariants>;
  expandedVariants: ReadonlySet<string>;
  optionNodeId: string | null;
  onToggleVariants: (id: string) => void;
  onAddVariant: (id: string) => void;
  onDismissOptions: () => void;
  selectedId: string | null;
  selectedIds: ReadonlySet<string>;
  onSelection: (ids: string[]) => void;
  onAction: (id: ActionId) => void;
  settings: WorkspaceSettings;
  focusContextIds: readonly string[] | null;
  onFocusContextChange: (ids: readonly string[] | null) => void;
  command: NavigationCommand | null;
  constraintAxis: "x" | "y" | "z" | null;
  onNodeClick: (id: string) => void;
  onNodeDoubleClick: (id: string) => void;
  onSubtreeClick: (id: string) => void;
  onBinderSelect: (id: string, kind: "composition" | "relationship" | "variant" | "visual", point: { x: number; y: number }) => void;
  onMove: (id: string, local: XYZ) => void;
  resolveMove: (id: string, local: XYZ) => XYZ;
  canNest: (id: string, targetId: string) => string | null;
  onNest: (id: string, targetId: string) => void;
  onContextAction: (action: ContextAction, target: ContextTarget) => void;
};
type CameraPose = { position: THREE.Vector3; target: THREE.Vector3; up: THREE.Vector3; contextIds: readonly string[] | null };
type SceneState = {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  renderer: THREE.WebGLRenderer;
  content: THREE.Group;
  appearance: ReturnType<typeof createSceneAppearance>;
  requestRender: () => void;
  requestPaint: () => void;
  focus: (kind: NavigationCommand["kind"], id?: string) => void;
};
type Menu = { x: number; y: number; target: ContextTarget };
const CLICK_THRESHOLD = 5;
const MOVE_DURATION = 380;
const asVector = (p: XYZ) => new THREE.Vector3(p.x, p.y, p.z);
const asXYZ = (p: THREE.Vector3): XYZ => ({ x: p.x, y: p.y, z: p.z });
const screenBounds = (object: THREE.Object3D, camera: THREE.PerspectiveCamera, width: number, height: number) => {
  const box = new THREE.Box3().setFromObject(object), points: THREE.Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z])
    points.push(new THREE.Vector3(x, y, z).project(camera));
  const x = Math.min(...points.map(p => (p.x + 1) * width / 2)), y = Math.min(...points.map(p => (1 - p.y) * height / 2));
  return { x, y, width: Math.max(...points.map(p => (p.x + 1) * width / 2)) - x, height: Math.max(...points.map(p => (1 - p.y) * height / 2)) - y };
};

function disposeContent(group: THREE.Group) {
  disposeVisual(group);
  group.clear();
}

export default function SpatialWorkspace(props: Props) {
  const { atlas, selectedId, settings, command, document: doc } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const optionBarRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SceneState | null>(null);
  const callbacks = useRef(props); callbacks.current = props;
  const baseGraph = projectSpatial(atlas);
  const graph = isolateSpatialContext(baseGraph, settings.isolateFocus ? props.focusContextIds : null);
  const fullGraphRef = useRef(baseGraph); fullGraphRef.current = baseGraph;
  const graphRef = useRef(graph); graphRef.current = graph;
  const meshes = useRef<LabelMesh[]>([]);
  const groups = useRef(new Map<string, THREE.Group>());
  const textScene = useRef<TextScene | null>(null);
  const volumeRadii = useRef(new Map<string, number>());
  const guides = useRef(new Set<HTMLDivElement>());
  const worldCoordinates = useRef(new Map<string, XYZ>());
  const attachGuide = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    guides.current.add(node); stateRef.current?.requestRender();
    return () => { guides.current.delete(node); };
  }, []);
  const [ready, setReady] = useState(false);
  const [fontRevision, setFontRevision] = useState(0);
  const nodeFont = normalizeFont(settings.appearance.renderDefaults?.['text.nodes']?.font ?? settings.appearance.font);
  const binderFont = normalizeFont(settings.appearance.renderDefaults?.['text.binders']?.font ?? settings.appearance.font);
  useEffect(() => {
    if (![settings.appearance.font, nodeFont, binderFont].some(font => font === "electric" || isCustomFont(font))) return;
    let active = true;
    const refresh = () => { if (active) setFontRevision(revision => revision + 1); };
    window.document.fonts.addEventListener("loadingdone", refresh);
    // Canvas textures must be regenerated after the bundled face finishes loading.
    Promise.all([...new Set([settings.appearance.font, nodeFont, binderFont])].map(font => loadFont(font))).then(refresh).catch(() => { /* The selected family already includes a system fallback. */ });
    return () => { active = false; window.document.fonts.removeEventListener("loadingdone", refresh); };
  }, [settings.appearance.font, nodeFont, binderFont]);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState<Menu | null>(null);
  const [feedback, setFeedback] = useState("");
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
    catch { setError("3D rendering is unavailable in this browser."); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x101927);
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101927);
    const camera = new THREE.PerspectiveCamera(DEFAULT_CAMERA_FOV, 1, 0.05, 100000);
    camera.position.copy(DEFAULT_CAMERA_POSITION);
    let controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false; controls.enablePan = true;
    controls.minDistance = 1.2; controls.maxDistance = 100000;
    const content = new THREE.Group(); scene.add(content);
    scene.add(new THREE.AmbientLight(0xffffff, 2.1));
    const light = new THREE.DirectionalLight(0xffffff, 2.2); light.position.set(5, 12, 9); scene.add(light);
    const appearance = createSceneAppearance(renderer, scene, camera);
    appearance.setSources(() => textScene.current);
    appearance.configure(callbacks.current.settings.appearance);
    let pendingRender = 0, animation = 0;
    const cameraHistory: CameraPose[] = [];
    const changeFocusContext = (ids: readonly string[] | null) => {
      callbacks.current.onFocusContextChange(ids);
    };
    const rememberCamera = () => cameraHistory.push({ position: camera.position.clone(), target: controls.target.clone(), up: camera.up.clone(), contextIds: callbacks.current.focusContextIds });
    let updateGeometry = false;
    const scheduleRender = (refresh: boolean) => {
      updateGeometry ||= refresh;
      if (pendingRender) return;
      pendingRender = requestAnimationFrame(() => {
        pendingRender = 0;
        if (updateGeometry) textScene.current?.update(camera, host.clientWidth, host.clientHeight);
        updateGeometry = false;
        const anchorElement = (element: HTMLElement | undefined | null, id: string, below = false) => {
          if (!element) return;
          const item = textScene.current?.nodes.get(id);
          if (!item || !item.sprite.visible) { element.style.visibility = "hidden"; return; }
          const p = item.group.position.clone().project(camera);
          element.style.visibility = p.z > -1 && p.z < 1 ? "visible" : "hidden";
          element.style.left = `${(p.x + 1) * host.clientWidth / 2}px`;
          const labelHeight = screenBounds(item.sprite, camera, host.clientWidth, host.clientHeight).height;
          element.style.top = `${(1 - p.y) * host.clientHeight / 2 + (below ? labelHeight / 2 + 10 : 0)}px`;
        };
        anchorElement(optionBarRef.current, callbacks.current.optionNodeId ?? "", true);
        const selected = worldCoordinates.current.get(callbacks.current.selectedId ?? "");
        for (const guide of guides.current) updateCameraGuide(guide, camera, controls.target, selected ? asVector(selected) : undefined);
        if (selectedBackground || hierarchyBackground !== null) applyBackgroundFeedback();
        appearance.render();
      });
    };
    const requestRender = () => scheduleRender(true);
    const hierarchyPulse = createGraphHierarchyPulse();
    let hierarchyBackground: number | null = null;
    let selectedBackground: { paint: SceneSelectionPaint; strength: number } | undefined;
    const applyBackgroundFeedback = () => {
      const theme = callbacks.current.settings.appearance;
      const color = new THREE.Color(theme.theme === "neon" ? theme.background : 0x101927);
      if (selectedBackground) {
        const { paint, strength } = selectedBackground;
        color.lerp(new THREE.Color(paint.color), Math.max(0, Math.min(1, paint.opacity * .3 * (.08 + .87 * strength))));
      } else if (hierarchyBackground !== null) color.lerp(new THREE.Color("white"), hierarchyBackground);
      scene.background = color;
    };
    const stopHierarchyHighlight = registerHierarchyScene({
      pulse: (targets, strength) => {
        hierarchyPulse.update(textScene.current, targets, strength);
        const background = targets.get("workspace.background");
        hierarchyBackground = background === undefined ? null : (0.05 + strength * .35) * (background ? 1 : .5);
        applyBackgroundFeedback();
        if (targets.size) scheduleRender(false);
      },
      clear: () => { hierarchyPulse.clear(); hierarchyBackground = null; applyBackgroundFeedback(); scheduleRender(false); },
      // Canvas bounds locate the surface; raycasting rejects actual scene objects.
      pick: (target, element, x, y) => target === "workspace.background" && element === renderer.domElement &&
        !hits({ clientX: x, clientY: y }).length &&
        !raycaster.intersectObjects(textScene.current?.binderHits.filter(object => object.visible) ?? [], false).length,
      paint: (target, element) => target === "workspace.background" && element === renderer.domElement
        ? new THREE.Color(callbacks.current.settings.appearance.theme === "neon" ? callbacks.current.settings.appearance.background : 0x101927).getStyle() : undefined,
      selection: (targets, strength) => {
        const paint = targets.get("workspace.background");
        selectedBackground = paint ? { paint, strength } : undefined;
        applyBackgroundFeedback(); scheduleRender(false);
      },
    });
    appearance.start(() => scheduleRender(false));
    const stopAnimation = () => { if (animation) cancelAnimationFrame(animation); animation = 0; };
    // OrbitControls caches its up-axis basis on construction. Rebind through its
    // public API after a discrete roll, without touching private engine fields.
    const rebindOrbit = () => {
      const previous = controls, target = previous.target.clone();
      previous.removeEventListener("change", requestRender); previous.removeEventListener("start", stopAnimation); previous.dispose();
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(target); controls.enableDamping = false;
      controls.minDistance = previous.minDistance; controls.maxDistance = previous.maxDistance;
      controls.mouseButtons = { ...previous.mouseButtons }; controls.enabled = previous.enabled;
      controls.addEventListener("change", requestRender); controls.addEventListener("start", stopAnimation);
      if (stateRef.current) stateRef.current.controls = controls;
      controls.update();
    };
    const clicks = nodeClicks((id) => callbacks.current.onNodeClick(id), (id) => callbacks.current.onNodeDoubleClick(id));
    const animate = (target: THREE.Vector3, distance: number, remember = true, facing?: THREE.Vector3) => {
      stopAnimation();
      if (remember) rememberCamera();
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
      if (isNudgeAction(kind)) {
        const node = graphRef.current.nodes.find(node => node.visible && node.id === (requestedId ?? callbacks.current.selectedId));
        if (!node || drag) return;
        stopAnimation();
        const horizontal = kind === "nudgeLeft" || kind === "nudgeRight";
        const sign = kind === "nudgeLeft" || kind === "nudgeDown" ? -1 : 1;
        const delta = new THREE.Vector3(horizontal ? sign : 0, horizontal ? 0 : sign, 0).applyQuaternion(camera.quaternion).multiplyScalar(callbacks.current.settings.spatial.spacing || 0.2);
        const parent = graphRef.current.nodes.find(parent => parent.id === node.parentId);
        const local = asVector(node.world).add(delta).sub(parent ? asVector(parent.world) : new THREE.Vector3());
        callbacks.current.onMove(node.id, asXYZ(local));
        return;
      }
      if (kind === "cancel") { selecting = null; setSelectionRect(null); controls.enabled = !uiPointerActive; clicks.cancel(); stopAnimation(); setMenu(null); setFeedback(""); return; }
      if (kind === "rollLeft" || kind === "rollRight") {
        stopAnimation(); rememberCamera();
        camera.up.applyAxisAngle(camera.getWorldDirection(new THREE.Vector3()), kind === "rollLeft" ? Math.PI / 2 : -Math.PI / 2).normalize();
        rebindOrbit(); requestRender(); return;
      }
      if (kind === "zoom100") { animate(controls.target.clone(), DEFAULT_CAMERA_POSITION.length()); return; }
      if (kind === "cameraOrigin") {
        stopAnimation(); rememberCamera(); camera.up.set(0, 1, 0); rebindOrbit();
        animate(new THREE.Vector3(), DEFAULT_CAMERA_POSITION.length(), false, DEFAULT_CAMERA_POSITION.clone().normalize());
        changeFocusContext(null); return;
      }
      if (kind === "back") {
        const pose = cameraHistory.pop(); if (!pose) return;
        stopAnimation();
        if (camera.up.distanceTo(pose.up) > 1e-6) { camera.up.copy(pose.up); rebindOrbit(); }
        changeFocusContext(pose.contextIds);
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
      const fullNodes = fullGraphRef.current.nodes.filter(n => n.visible);
      const primary = fullNodes.find(n => n.id === requestedId) ?? fullNodes.find(n => n.id === callbacks.current.selectedId) ?? fullNodes.find(n => n.parentId === null) ?? fullNodes[0];
      const contextIds = kind === "all" || kind === "hierarchy" ? null
        : kind === "selection" ? fullNodes.filter(n => callbacks.current.selectedIds.has(n.id)).map(n => n.id)
        : primary ? [primary.id] : null;
      const nodes = isolateSpatialContext(fullGraphRef.current, callbacks.current.settings.isolateFocus ? contextIds : null).nodes.filter(n => n.visible);
      if (!nodes.length) return;
      if (kind === "all" || kind === "hierarchy" || kind === "variants" || kind === "selection" || callbacks.current.settings.isolateFocus) {
        const bounds = new THREE.Box3();
        const framing = callbacks.current.settings.isolateFocus ? nodes : kind === "selection" ? nodes.filter((n) => callbacks.current.selectedIds.has(n.id)) : kind === "variants" ? nodes.filter((n) => n.id === requestedId || n.variantOwnerId === requestedId) : nodes;
        if (!framing.length) return;
        for (const node of framing) {
          const placement = callbacks.current.document.placements.find(p => p.id === node.id);
          const footprint = visualFootprint(labelSize(node.label), placement?.visual, callbacks.current.settings.spatial.sphereDiameter);
          const center = asVector(node.world), half = new THREE.Vector3(footprint.width / 2, footprint.height / 2, footprint.depth / 2);
          bounds.expandByPoint(center.clone().add(half)); bounds.expandByPoint(center.clone().sub(half));
        }
        const center = bounds.getCenter(new THREE.Vector3());
        animate(center, Math.max(6, bounds.getSize(new THREE.Vector3()).length() * 1.2), true, kind === "hierarchy" ? new THREE.Vector3(0, 0, 1) : undefined);
        changeFocusContext(contextIds); return;
      }
      const node = nodes.find((n) => n.id === primary?.id) ?? nodes.find((n) => n.parentId === null) ?? nodes[0];
      const point = asVector(node.world);
      let radius = callbacks.current.settings.spatial.radius;
      if (kind === "local") {
        const children = nodes.filter((n) => n.parentId === node.id);
        for (const child of children) radius = Math.max(radius, point.distanceTo(asVector(child.world)) + (volumeRadii.current.get(child.id) ?? radius));
      } else radius = volumeRadii.current.get(node.id) ?? radius;
      const fov = THREE.MathUtils.degToRad(camera.fov);
      animate(point, Math.max(4, radius / Math.tan(fov / 2) * 1.5));
      changeFocusContext(contextIds);
    };
    stateRef.current = { camera, controls, renderer, content, appearance, requestRender, requestPaint: () => scheduleRender(false), focus };
    const resize = () => {
      camera.aspect = Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight);
      camera.updateProjectionMatrix(); renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight), false); requestRender();
      appearance.resize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    controls.addEventListener("change", requestRender);
    controls.addEventListener("start", stopAnimation);
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const aim = (event: Pick<PointerEvent, "clientX" | "clientY">) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
    };
    const hits = (event: Pick<PointerEvent, "clientX" | "clientY">, except?: string) => {
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
    let binderDown: { id: string; kind: "composition" | "relationship" | "variant" | "visual"; x: number; y: number } | null = null;
    let selecting: { x: number; y: number; clientX: number; clientY: number; id?: string; additive: boolean } | null = null;
    let uiPointerActive = false;
    raycaster.params.Line.threshold = 0.08;
    let hovered: LabelMesh | null = null;
    const paintHover = (mesh: LabelMesh | null) => {
      if (hovered === mesh) return;
      if (hovered) {
        hovered.material.color.copy(hovered.userData.baseColor ?? new THREE.Color("white"));
        const outline = hovered.userData.hoverOutline as THREE.Object3D | undefined;
        if (outline) outline.visible = outline.userData.selected;
      }
      hovered = mesh;
      if (hovered) {
        if (!hovered.userData.visualProxy) hovered.material.color.lerp(new THREE.Color("white"), 0.2);
        const outline = hovered.userData.hoverOutline as THREE.Object3D | undefined;
        if (outline) outline.visible = true;
      }
      renderer.domElement.style.cursor = hovered ? "grab" : "default";
      requestRender();
    };
    const down = (event: PointerEvent) => {
      if (!pointerOwner.owns(event)) return;
      stopAnimation(); setMenu(null);
      if (event.button === 3 || event.button === 4) {
        event.preventDefault(); event.stopImmediatePropagation();
        callbacks.current.onAction(event.button === 3 ? callbacks.current.settings.mouse.backButton : callbacks.current.settings.mouse.forwardButton); return;
      }
      if (event.button === 0 && subtreeGesture(event, callbacks.current.settings.mouse.selectionModifier)) {
        event.preventDefault(); event.stopImmediatePropagation(); clicks.cancel(); callbacks.current.onDismissOptions();
        const rect = host.getBoundingClientRect();
        selecting = { x: event.clientX - rect.left, y: event.clientY - rect.top, clientX: event.clientX, clientY: event.clientY, id: hits(event)[0]?.object.userData.nodeId, additive: event.shiftKey };
        controls.enabled = false; renderer.domElement.setPointerCapture(event.pointerId); return;
      }
      if (event.button === 2) {
        clicks.cancel();
        callbacks.current.onDismissOptions();
        const hit = hits(event)[0]?.object;
        rightDown = { x: event.clientX, y: event.clientY, id: hit?.userData.nodeId ?? null, world: cursorWorld(event) };
        return;
      }
      if (event.button !== 0) return;
      const hit = hits(event)[0];
      if (!hit) {
        clicks.cancel();
        callbacks.current.onDismissOptions();
        const binder = raycaster.intersectObjects(textScene.current?.binderHits.filter((object) => object.visible) ?? [], false)[0]?.object;
        if (binder && ["composition", "relationship", "variant", "visual"].includes(binder.userData.binderKind)) binderDown = { id: binder.userData.binderId, kind: binder.userData.binderKind, x: event.clientX, y: event.clientY };
        return;
      }
      const id = hit.object.userData.nodeId as string, group = groups.current.get(id); if (!group) return;
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
      if (uiPointerActive || (event.buttons !== 0 && !pointerOwner.owns(event))) return;
      if (selecting) {
        const rect = host.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
        setSelectionRect({ x: Math.min(x, selecting.x), y: Math.min(y, selecting.y), width: Math.abs(x - selecting.x), height: Math.abs(y - selecting.y) }); return;
      }
      if (!drag) { if (event.buttons === 0) paintHover((hits(event)[0]?.object as LabelMesh) ?? null); return; }
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= CLICK_THRESHOLD) clicks.cancel();
      aim(event);
      const intersection = raycaster.ray.intersectPlane(drag.plane, new THREE.Vector3()); if (!intersection) return;
      const wanted = intersection.add(drag.offset);
      const axis = callbacks.current.constraintAxis;
      if (axis) for (const other of ["x", "y", "z"] as const) if (other !== axis) wanted[other] = drag.startWorld[other];
      const node = graphRef.current.nodes.find((n) => n.id === drag!.id)!;
      const parent = graphRef.current.nodes.find((n) => n.id === node.parentId);
      const parentWorld = parent ? asVector(parent.world) : new THREE.Vector3();
      if (subtreeGesture(event, callbacks.current.settings.mouse.nestModifier)) {
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
      controls.enabled = !uiPointerActive;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      scene.remove(current.marker); current.marker.geometry.dispose(); (current.marker.material as THREE.Material).dispose();
      setFeedback("");
      if (!cancelled) {
        if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < CLICK_THRESHOLD) {
          if (subtreeGesture(event, callbacks.current.settings.mouse.subtreeModifier)) { clicks.cancel(); callbacks.current.onSubtreeClick(current.id); }
          else clicks.click(current.id);
        }
        else if (subtreeGesture(event, callbacks.current.settings.mouse.nestModifier) && current.nestTarget) callbacks.current.onNest(current.id, current.nestTarget);
        else if (!subtreeGesture(event, callbacks.current.settings.mouse.nestModifier) && current.local) callbacks.current.onMove(current.id, current.local);
      }
      requestRender();
    };
    const up = (event: PointerEvent) => {
      if (uiPointerActive) return;
      if (event.button === 3 || event.button === 4) { event.preventDefault(); return; }
      if (selecting && event.button === 0) {
        const start = selecting; selecting = null; controls.enabled = !uiPointerActive; setSelectionRect(null);
        if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
        if (Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) < CLICK_THRESHOLD) {
          const ids = new Set(callbacks.current.selectedIds);
          if (start.id) { if (ids.has(start.id)) ids.delete(start.id); else ids.add(start.id); } else ids.clear();
          callbacks.current.onSelection([...ids]); return;
        }
        const rect = host.getBoundingClientRect();
        const x1 = Math.min(start.x, event.clientX - rect.left), x2 = Math.max(start.x, event.clientX - rect.left);
        const y1 = Math.min(start.y, event.clientY - rect.top), y2 = Math.max(start.y, event.clientY - rect.top);
        const ids = new Set(start.additive ? callbacks.current.selectedIds : []);
        for (const [id, item] of textScene.current?.nodes ?? []) {
          const center = item.group.position.clone().project(camera);
          if (!item.sprite.visible || center.z < -1 || center.z > 1) continue;
          const box = screenBounds(item.sprite, camera, rect.width, rect.height);
          if (box.x + box.width >= x1 && box.x <= x2 && box.y + box.height >= y1 && box.y <= y2) ids.add(id);
        }
        callbacks.current.onSelection([...ids]); return;
      }
      if (event.button === 0 && binderDown) {
        const b = binderDown; binderDown = null;
        if (Math.hypot(event.clientX - b.x, event.clientY - b.y) < CLICK_THRESHOLD) callbacks.current.onBinderSelect(b.id, b.kind, { x: event.clientX, y: event.clientY });
      }
      if (event.button === 2 && rightDown) {
        const right = rightDown; rightDown = null;
        if (Math.hypot(event.clientX - right.x, event.clientY - right.y) < CLICK_THRESHOLD) {
          const rect = host.getBoundingClientRect();
          if (right.id && !(callbacks.current.selectedIds.size > 1 && callbacks.current.selectedIds.has(right.id))) callbacks.current.onSelection([right.id]);
          setMenu({ x: Math.min(event.clientX - rect.left, rect.width - 215), y: Math.min(event.clientY - rect.top, rect.height - 360),
            target: callbacks.current.selectedIds.size > 1 && (!right.id || callbacks.current.selectedIds.has(right.id)) ? { kind: "selection", ids: [...callbacks.current.selectedIds] } : right.id ? { kind: "node", id: right.id } : { kind: "space", world: right.world, screen: { x: event.clientX, y: event.clientY } } });
        }
      }
      if (event.button === 0) finishDrag(event);
    };
    const cancel = (event: PointerEvent) => { selecting = null; setSelectionRect(null); controls.enabled = !uiPointerActive; clicks.cancel(); finishDrag(event, true); };
    const pointerOwner = guardCameraPointer(renderer.domElement, (active) => {
      uiPointerActive = active;
      controls.enabled = !active && !drag && !selecting;
      if (active) stopAnimation();
    }, () => {
      clicks.cancel(); stopAnimation();
      selecting = null; rightDown = null; binderDown = null; setSelectionRect(null);
      if (drag) {
        const marker = drag.marker; drag = null;
        scene.remove(marker); marker.geometry.dispose(); (marker.material as THREE.Material).dispose();
        setFeedback(""); requestRender();
      }
      // Recreate via the public API: disconnect alone leaves OrbitControls'
      // tracked pointers and pan/rotate state alive after a lost release.
      controls.enabled = !uiPointerActive;
      rebindOrbit();
    });
    const preventMenu = (event: MouseEvent) => event.preventDefault();
    renderer.domElement.addEventListener("pointerdown", down, true);
    renderer.domElement.addEventListener("auxclick", preventMenu);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", cancel);
    renderer.domElement.addEventListener("contextmenu", preventMenu);
    setReady(true);
    return () => {
      stopHierarchyHighlight(); hierarchyPulse.dispose();
      pointerOwner.dispose();
      clicks.cancel(); stopAnimation(); cancelAnimationFrame(pendingRender);
      renderer.domElement.removeEventListener("pointerdown", down, true);
      renderer.domElement.removeEventListener("auxclick", preventMenu);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointercancel", cancel);
      renderer.domElement.removeEventListener("contextmenu", preventMenu);
      observer.disconnect(); controls.dispose(); appearance.dispose(); disposeContent(content); renderer.dispose(); renderer.domElement.remove(); stateRef.current = null;
    };
  }, []);

  useEffect(() => {
    const state = stateRef.current; if (!state || !ready) return;
    const button = (action: "pan" | "rotate" | "none") => action === "pan" ? THREE.MOUSE.PAN : action === "rotate" ? THREE.MOUSE.ROTATE : null;
    state.controls.mouseButtons = { LEFT: button(settings.mouse.leftEmpty), MIDDLE: THREE.MOUSE.DOLLY, RIGHT: button(settings.mouse.rightEmpty) };
  }, [ready, settings.mouse.leftEmpty, settings.mouse.rightEmpty]);
  useEffect(() => {
    const state = stateRef.current; if (!state || !ready) return;
    state.appearance.configure(settings.appearance); state.requestPaint();
  }, [ready, settings.appearance]);

  useEffect(() => {
    const state = stateRef.current; if (!state || !ready) return;
    disposeContent(state.content);
    const visible = graph.nodes.filter((n) => n.visible);
    const visibleIds = new Set(visible.map(n => n.id));
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const binders = chartedBinders(doc, atlas).flatMap((b) => {
      const from = byId.get(b.source), to = byId.get(b.target);
      if (!from || !to || (from.representative === to.representative && (!from.visible || !to.visible))) return [];
      if (!visibleIds.has(from.representative) || !visibleIds.has(to.representative)) return [];
      return [{ ...b, source: from.representative, target: to.representative }];
    });
    const built = buildTextScene(state.content, visible, binders, doc, selectedId, state.requestRender, props.selectedIds, settings.appearance, settings.spatial.sphereDiameter);
    textScene.current = built;
    meshes.current = built.nodeHits;
    groups.current = new Map([...built.nodes].map(([id, node]) => [id, node.group]));
    volumeRadii.current = occupiedRadii(doc, settings.spatial);
    worldCoordinates.current = worldPositions(doc);
    state.requestRender();
  }, [atlas, doc, selectedId, ready, settings.spatial.radius, settings.spatial.sphereDiameter, settings.spatial.clearance, settings.isolateFocus, props.focusContextIds, props.variantDisplay, props.selectedIds, settings.appearance.font, nodeFont, binderFont, fontRevision, settings.appearance.theme]);

  useEffect(() => {
    textScene.current?.applyTheme(settings.appearance, props.colorPreview);
    stateRef.current?.requestPaint();
  }, [ready, atlas, doc, selectedId, props.selectedIds, settings.appearance, settings.spatial.sphereDiameter, props.colorPreview]);

  useEffect(() => { if (command) stateRef.current?.focus(command.kind, command.id); }, [command]);
  const nodeMenu: [ContextAction, string][] = [
    ["createChild", "Create child"], ["insertExisting", "Insert existing entity"], ["connect", "Connect to another node"],
    ["toggle", "Expand / collapse"], ["focus", "Focus"], ["edit", "Rename / edit in inspector"],
    ["removePlacement", "Remove placement"], ["deleteIdentity", "Delete identity…"],
  ];
  const spaceMenu: [ContextAction, string][] = [
    ["createAt", "Create node here"], ["insertExisting", "Insert existing entity"], ["createUIFrame", "Create UI frame"],
    ["compact", "Compact layout"], ["fitAll", "Fit entire atlas"], ["settings", "Workspace settings"],
  ];
  const selectionMenu: [ContextAction, string][] = [["focus", "Focus selection"], ["expand", "Expand selected"], ["collapse", "Collapse selected"], ["compact", "Compact selection"], ["deleteIdentity", "Delete selected concepts and subnodes…"]];
  const menuItems = menu?.target.kind === "selection" ? selectionMenu : menu?.target.kind === "node" ? nodeMenu : spaceMenu;
  return <div className="spatial-workspace" aria-label="3D Omnium workspace" ref={hostRef}>
    {error && <div className="spatial-error" role="alert">{error}</div>}
    <div className="spatial-help">Click: options / variants · double-click: expand / collapse · {settings.mouse.subtreeModifier !== "none" && `${settings.mouse.subtreeModifier}-click: entire subtree · `}{settings.mouse.selectionModifier}-drag: select · {settings.mouse.nestModifier}-drag: nest · right-drag: rotate</div>
    {props.optionNodeId && <div ref={optionBarRef} className="node-options" role="toolbar" aria-label="Node options">
      {NODE_OPTIONS.map((option) => <div className="node-option" key={option.id}>
        <button aria-expanded={props.expandedVariants.has(props.optionNodeId!)} onClick={() => props.onToggleVariants(props.optionNodeId!)}>{option.label}</button>
        {option.id === "variants" && <button className="variant-add" aria-label={`Add variant for ${graph.nodes.find((n) => n.id === props.optionNodeId)?.label || "node"}`} title="Add variant" onContextMenu={(event) => event.preventDefault()} onClick={() => props.onAddVariant(props.optionNodeId!)}>+</button>}
      </div>)}
    </div>}
    <div className="spatial-controls">
      <FunctionControl id="focus" /><FunctionControl id="isolateFocus" /><FunctionControl id="fitLocal" /><FunctionControl id="fitAll" /><FunctionControl id="back" />
    </div>
    <div className="camera-guide-home"><CameraGuide attach={attachGuide} /></div>
    {selectionRect && <div className="selection-rectangle" style={{ left: selectionRect.x, top: selectionRect.y, width: selectionRect.width, height: selectionRect.height }} />}
    {!!props.selectedIds.size && <div className="selection-status" role="status">{props.selectedIds.size} selected <button onClick={() => props.onAction("focus")}>Focus</button><button onClick={() => props.onAction("deleteSelected")}>Delete</button><button onClick={() => props.onSelection([])}>Clear</button></div>}
    {feedback && <div className="spatial-feedback" role="status">{feedback}</div>}
    {menu && <EntityMenu kind={menu.target.kind} x={Math.max(0, menu.x)} y={Math.max(0, menu.y)} bounds={{ width: hostRef.current?.clientWidth ?? window.innerWidth, height: hostRef.current?.clientHeight ?? window.innerHeight }} items={menuItems} onDismiss={() => setMenu(null)} onChoose={(action) => { callbacks.current.onContextAction(action, menu.target); setMenu(null); }} />}
  </div>;
}
