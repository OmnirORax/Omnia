import * as THREE from "three";
import type { Document, XYZ } from "../graph/structural";
import { worldPositions } from "../graph/coordinates.ts";
import { navigateCamera, navigationRotation, type CameraPose } from "./model.ts";
import { MAX_TRANSFORM_TARGETS, MODES, navigationConstraint, type NavigationOptions } from "./options.ts";
import { identityRotation, transformTargets, type Rotation } from "./transforms.ts";
type Host = {
  group: THREE.Group; anchor: THREE.Vector3;
};
type Environment = {
  camera: THREE.PerspectiveCamera; scene: THREE.Scene; canvas: HTMLCanvasElement;
  target: () => THREE.Vector3; nodes: () => ReadonlyMap<string, Host> | undefined;
  document: () => Document; selection: () => ReadonlySet<string>;
  pointed: (point: { clientX: number; clientY: number }) => string | undefined;
  request: () => void; enabled: (value: boolean) => void; rebind: () => void;
  feedback: (text: string) => void;
  commit: (ids: string[], rotation: Rotation, pivot: XYZ, layout: boolean) => void;
  remember: (pose: CameraPose) => void;
  distanceLimits?: () => { min: number; max: number };
};
const xyz = (v: THREE.Vector3): XYZ => ({ x: v.x, y: v.y, z: v.z });
const qvalue = (q: THREE.Quaternion): Rotation => ({ x: q.x, y: q.y, z: q.z, w: q.w });
const vector = (p: XYZ) => new THREE.Vector3(p.x, p.y, p.z);
const coords = (v: THREE.Vector3) => `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`;
export function createNavigationGesture(env: Environment) {
  const marker = new THREE.AxesHelper(1); marker.visible = false; marker.renderOrder = 1000;
  for (const material of Array.isArray(marker.material) ? marker.material : [marker.material]) { material.depthTest = false; material.depthWrite = false; }
  env.scene.add(marker);
  type Snapshot = { doc: Document; selection: ReadonlySet<string>; point: { x: number; y: number }; pointed?: string; worlds: Map<string, XYZ>; center?: THREE.Vector3; targets: Map<string, string[]>; cameraKey: string };
  let cached: Snapshot | undefined;
  const context = (point: { x: number; y: number }) => {
    const doc = env.document(), selection = env.selection();
    const cameraKey = [...env.camera.position.toArray(), ...env.camera.quaternion.toArray(), env.camera.aspect, env.camera.zoom, env.camera.fov].join(",");
    if (cached && cached.doc === doc && cached.cameraKey === cameraKey && cached.selection === selection && cached.point.x === point.x && cached.point.y === point.y) return cached;
    let worlds: Map<string, XYZ> | undefined, pointed: string | undefined, checkedPoint = false;
    cached = { doc, selection, point, cameraKey, targets: new Map(),
      get pointed() { if (!checkedPoint) { pointed = env.pointed({ clientX: point.x, clientY: point.y }); checkedPoint = true; } return pointed; },
      get worlds() { return worlds ??= worldPositions(doc); } }; return cached;
  };
  const cameraPose = (): CameraPose => ({ position: env.camera.position.clone(), target: env.target().clone(), up: env.camera.up.clone() });
  const center = (ids: readonly string[], snapshot: Snapshot) => {
    if (snapshot.center) return snapshot.center.clone();
    const values = ids.flatMap(id => snapshot.worlds.has(id) ? [snapshot.worlds.get(id)!] : []);
    if (!values.length) throw new Error("Select nodes for the selection center.");
    snapshot.center = values.reduce<THREE.Vector3>((sum, p) => sum.add(vector(p)), new THREE.Vector3()).divideScalar(values.length); return snapshot.center.clone();
  };
  const resolve = (options: NavigationOptions, snapshot: Snapshot) => {
    const nodeMode = options.mode === "orient" || options.mode === "layout";
    const key = `${options.target}:${options.descendants}`;
    let ids = nodeMode ? snapshot.targets.get(key) : [];
    if (!ids) { ids = transformTargets(snapshot.doc, options.target === "pointed" ? snapshot.pointed ? [snapshot.pointed] : [] : [...snapshot.selection], options.descendants, MAX_TRANSFORM_TARGETS); snapshot.targets.set(key, ids); }
    if (nodeMode && !ids.length) throw new Error(options.target === "pointed" ? "Point at a node to turn it." : "Select nodes to turn them.");
    let pivot = env.target().clone();
    if (options.mode === "look" || options.mode === "walk" || options.mode === "pan") pivot.copy(env.camera.position);
    else if (options.mode === "orient") pivot.copy(vector(snapshot.worlds.get(ids[0])!));
    else if (options.pivot === "origin") pivot.set(0, 0, 0);
    else if (options.pivot === "selection") pivot.copy(center([...snapshot.selection], snapshot));
    else if (options.pivot === "pointed") {
      if (!snapshot.pointed || !snapshot.worlds.has(snapshot.pointed)) throw new Error("Point at a node to use its center as pivot.");
      pivot.copy(vector(snapshot.worlds.get(snapshot.pointed)!));
    }
    const limits = env.distanceLimits?.() ?? { min: .01, max: Infinity };
    if (options.mode === "orbit" && (env.camera.position.distanceTo(pivot) < limits.min || env.camera.position.distanceTo(pivot) > limits.max)) throw new Error(`Orbit radius must be ${limits.min}–${limits.max} world units; choose another pivot or Look around.`);
    return { ids, pivot };
  };
  const describe = (options: NavigationOptions, ids: string[], pivot: THREE.Vector3) => {
    const camera = options.mode === "orbit" || options.mode === "look" || options.mode === "walk" || options.mode === "pan";
    const limits = env.distanceLimits?.();
    const axis = navigationConstraint(options) + (options.mode === "orbit" && limits ? ` · radius ${limits.min}–${limits.max}` : "");
    const where = options.mode === "orient" ? "each node center (marker: first node)" : options.mode === "look" || options.mode === "walk" || options.mode === "pan" ? `camera position ${coords(pivot)}` : `${options.pivot} pivot ${coords(pivot)}`;
    return `${MODES.find(mode => mode.id === options.mode)?.label} · ${camera ? "camera" : `${ids.length} nodes${options.descendants ? " incl. descendants" : " only"}`} · ${where} · ${axis}`;
  };
  const show = (options: NavigationOptions, pivot: THREE.Vector3) => {
    marker.visible = options.mode !== "look" && options.mode !== "walk" && options.mode !== "pan";
    marker.position.copy(pivot); marker.scale.setScalar(Math.max(.02, env.camera.position.distanceTo(pivot) * .035)); env.request();
  };
  type Gesture = { pointer: number; button: number; start: { x: number; y: number }; pose: CameraPose; options: NavigationOptions; ids: string[]; pivot: THREE.Vector3;
    originals: { id: string; position: THREE.Vector3; rotation: THREE.Quaternion; host?: Host }[]; rotation: THREE.Quaternion; dragged: boolean };
  let gesture: Gesture | null = null;
  const restore = (current: Gesture) => {
    env.camera.position.copy(current.pose.position); env.camera.up.copy(current.pose.up); env.target().copy(current.pose.target); env.camera.lookAt(env.target());
    for (const original of current.originals) if (original.host) { original.host.anchor.copy(original.position); original.host.group.quaternion.copy(original.rotation); }
  };
  return {
    get active() { return !!gesture; },
    acceptsRelease(event: PointerEvent) { return !!gesture && event.pointerId === gesture.pointer && event.button === gesture.button; },
    preview(options: NavigationOptions | null, point: { x: number; y: number }) {
      if (!options) { if (!gesture) { marker.visible = false; env.request(); } return ""; }
      try { const { ids, pivot } = resolve(options, context(point)); show(options, pivot); return describe(options, ids, pivot); }
      catch (error) { marker.visible = false; env.request(); return error instanceof Error ? error.message : String(error); }
    },
    begin(event: PointerEvent, options: NavigationOptions) {
      if (gesture) return false;
      try {
        const start = { x: event.clientX, y: event.clientY }, snapshot = context(start), { ids, pivot } = resolve(options, snapshot);
        const placements = new Map(ids.length ? snapshot.doc.placements.map(p => [p.id, p] as const) : []);
        gesture = { pointer: event.pointerId, button: event.button, start, pose: cameraPose(), options: { ...options }, ids, pivot, rotation: new THREE.Quaternion(), dragged: false,
          originals: ids.map(id => { const orientation = placements.get(id)?.orientation ?? identityRotation(); return { id, position: vector(snapshot.worlds.get(id)!), rotation: new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w), host: env.nodes()?.get(id) }; }) };
        env.enabled(false); env.canvas.setPointerCapture(event.pointerId); env.feedback(describe(options, ids, pivot)); show(options, pivot); return true;
      } catch (error) { env.feedback(error instanceof Error ? error.message : String(error)); return false; }
    },
    move(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.pointer) return false;
      const dx = event.clientX - gesture.start.x, dy = event.clientY - gesture.start.y;
      if (Math.hypot(dx, dy) < 5 && !gesture.dragged) return true;
      gesture.dragged = true;
      const { pose, options, pivot } = gesture;
      if (options.mode === "orient" || options.mode === "layout") {
        gesture.rotation.copy(navigationRotation(pose, options, dx, dy, pivot));
        for (const original of gesture.originals) if (original.host) {
          if (options.mode === "orient") original.host.group.quaternion.copy(gesture.rotation).multiply(original.rotation).normalize();
          else original.host.anchor.copy(original.position).sub(pivot).applyQuaternion(gesture.rotation).add(pivot);
        }
      } else {
        const next = navigateCamera(pose, options, dx, dy, pivot);
        env.camera.position.copy(next.position); env.camera.up.copy(next.up); env.target().copy(next.target); env.camera.lookAt(next.target); env.camera.updateMatrixWorld();
      }
      env.request(); return true;
    },
    finish(cancelled = false) {
      if (!gesture) return false;
      const current = gesture; gesture = null;
      let rememberView = false;
      try {
      if (cancelled) restore(current);
      else if (current.dragged) {
        if (current.options.mode === "orient" || current.options.mode === "layout") {
          if (Math.hypot(current.rotation.x, current.rotation.y, current.rotation.z) > 1e-8) env.commit(current.ids, qvalue(current.rotation), xyz(current.pivot), current.options.mode === "layout");
        } else if (current.pose.position.distanceToSquared(env.camera.position) + current.pose.target.distanceToSquared(env.target()) + current.pose.up.distanceToSquared(env.camera.up) > 1e-10) rememberView = true;
      }
      } finally {
      if (env.canvas.hasPointerCapture(current.pointer)) env.canvas.releasePointerCapture(current.pointer);
      marker.visible = false; env.enabled(true); env.rebind(); env.feedback(""); env.request();
      }
      if (rememberView) env.remember(current.pose);
      return current.dragged;
    },
    dispose() { if (gesture) restore(gesture); gesture = null; env.scene.remove(marker); marker.geometry.dispose(); for (const material of Array.isArray(marker.material) ? marker.material : [marker.material]) material.dispose(); },
  };
}
