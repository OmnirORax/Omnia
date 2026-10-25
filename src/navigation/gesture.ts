import * as THREE from "three";
import { constrainDrag, moveTrackball, trackballPoint, type DragConstraint, type Trackball } from "./trackball.ts";
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
  branch?: () => string | null;
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
  type Snapshot = { doc: Document; selection: ReadonlySet<string>; point: { x: number; y: number }; pointed?: string; worlds: Map<string, XYZ>; center?: THREE.Vector3; targets: Map<string, string[]>; cameraKey: string; branch: string | null };
  let cached: Snapshot | undefined;
  const context = (point: { x: number; y: number }) => {
    const doc = env.document(), selection = env.selection(), branch = env.branch?.() ?? null;
    const cameraKey = [...env.camera.position.toArray(), ...env.camera.quaternion.toArray(), env.camera.aspect, env.camera.zoom, env.camera.fov].join(",");
    if (cached && cached.doc === doc && cached.branch === branch && cached.cameraKey === cameraKey && cached.selection === selection && cached.point.x === point.x && cached.point.y === point.y) return cached;
    let worlds: Map<string, XYZ> | undefined, pointed: string | undefined, checkedPoint = false;
    cached = { doc, selection, point, cameraKey, branch, targets: new Map(),
      get pointed() { if (!checkedPoint) { pointed = env.pointed({ clientX: point.x, clientY: point.y }); checkedPoint = true; } return pointed; },
      get worlds() { return worlds ??= worldPositions(doc); } }; return cached;
  };
  const kind = (snapshot: Snapshot) => snapshot.pointed ? "nodes" : snapshot.selection.size ? "graph" : "space";
  const anchor = (snapshot: Snapshot) => {
    if (snapshot.branch && snapshot.worlds.has(snapshot.branch)) return snapshot.branch;
    const parents = new Map(snapshot.doc.placements.map(p => [p.id, p.parentId]));
    return [...snapshot.selection].find(id => snapshot.worlds.has(id) && !snapshot.selection.has(parents.get(id) ?? "")) ?? [...snapshot.selection][0];
  };
  const contextual = (options: NavigationOptions, snapshot: Snapshot): NavigationOptions => {
    if (options.mode !== "auto") return options;
    const scope = kind(snapshot), actor = options.actor === "auto" ? scope === "nodes" ? "object" : "camera" : options.actor;
    return { ...options, actor, mode: scope === "space" ? "look" : actor === "object" ? scope === "graph" ? "layout" : "orient" : "orbit",
      target: scope === "graph" ? "selection" : "pointed", pivot: scope === "graph" ? "selection" : "pointed" };
  };
  const cameraPose = (): CameraPose => ({ position: env.camera.position.clone(), target: env.target().clone(), up: env.camera.up.clone() });
  const center = (ids: readonly string[], snapshot: Snapshot) => {
    if (snapshot.center) return snapshot.center.clone();
    const branch = anchor(snapshot);
    if (branch && snapshot.worlds.has(branch)) return vector(snapshot.worlds.get(branch)!);
    const values = ids.flatMap(id => snapshot.worlds.has(id) ? [snapshot.worlds.get(id)!] : []);
    if (!values.length) throw new Error("Select nodes for the selection center.");
    snapshot.center = values.reduce<THREE.Vector3>((sum, p) => sum.add(vector(p)), new THREE.Vector3()).divideScalar(values.length); return snapshot.center.clone();
  };
  const resolve = (options: NavigationOptions, snapshot: Snapshot, fitting = false) => {
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
    if (!fitting && options.mode === "orbit" && (env.camera.position.distanceTo(pivot) < limits.min || env.camera.position.distanceTo(pivot) > limits.max)) throw new Error(`Orbit radius must be ${limits.min}–${limits.max} world units; choose another pivot or Look around.`);
    return { ids, pivot };
  };
  const describe = (options: NavigationOptions, ids: string[], pivot: THREE.Vector3) => {
    const camera = options.mode === "orbit" || options.mode === "look" || options.mode === "walk" || options.mode === "pan";
    const limits = env.distanceLimits?.();
    const axis = ((options.mode === "orient" || options.mode === "layout") && options.axis === "free" ? "trackball · center tilts / edge spins" : navigationConstraint(options)) + (options.mode === "orbit" && limits ? ` · radius ${limits.min}–${limits.max}` : "");
    const where = options.mode === "orient" ? "each node center (marker: first node)" : options.mode === "look" || options.mode === "walk" || options.mode === "pan" ? `camera position ${coords(pivot)}` : `${options.pivot} pivot ${coords(pivot)}`;
    return `${MODES.find(mode => mode.id === options.mode)?.label} · ${camera ? "camera" : `${ids.length} nodes${options.descendants ? " incl. descendants" : " only"}`} · ${where} · ${axis}`;
  };
  const show = (options: NavigationOptions, pivot: THREE.Vector3) => {
    marker.visible = options.mode !== "look" && options.mode !== "walk" && options.mode !== "pan";
    marker.position.copy(pivot); marker.scale.setScalar(Math.max(.02, env.camera.position.distanceTo(pivot) * .035)); env.request();
  };
  type Gesture = { pointer: number; button: number; start: { x: number; y: number }; pose: CameraPose; before: CameraPose; fit: boolean; fitIds: string[]; blocked?: boolean; options: NavigationOptions; ids: string[]; pivot: THREE.Vector3;
    originals: { id: string; position: THREE.Vector3; rotation: THREE.Quaternion; host?: Host }[]; rotation: THREE.Quaternion; dragged: boolean; trackball?: Trackball; constraint: DragConstraint };
  let gesture: Gesture | null = null;
  const restore = (current: Gesture) => {
    env.camera.position.copy(current.before.position); env.camera.up.copy(current.before.up); env.target().copy(current.before.target); env.camera.lookAt(env.target());
    for (const original of current.originals) if (original.host) { original.host.anchor.copy(original.position); original.host.group.quaternion.copy(original.rotation); }
  };
  return {
    get active() { return !!gesture; },
    contextBranch(point: { x: number; y: number }) { const snapshot = context(point); return kind(snapshot) === "nodes" ? snapshot.pointed : kind(snapshot) === "graph" ? anchor(snapshot) : null; },
    contextKind(point: { x: number; y: number }) { return kind(context(point)); },
    acceptsRelease(event: PointerEvent) { return !!gesture && event.pointerId === gesture.pointer && event.button === gesture.button; },
    preview(options: NavigationOptions | null, point: { x: number; y: number }) {
      if (!options) { if (!gesture) { marker.visible = false; env.request(); } return ""; }
      try { const snapshot = context(point); const fitting = options.mode === "auto" && options.actor !== "object" && kind(snapshot) === "graph"; options = contextual(options, snapshot); const { ids, pivot } = resolve(options, snapshot, fitting); show(options, pivot); return describe(options, ids, pivot); }
      catch (error) { marker.visible = false; env.request(); return error instanceof Error ? error.message : String(error); }
    },
    begin(event: PointerEvent, options: NavigationOptions) {
      if (gesture) return false;
      try {
        const start = { x: event.clientX, y: event.clientY }, snapshot = context(start);
        const fit = options.mode === "auto" && options.actor !== "object" && kind(snapshot) === "graph";
        options = contextual(options, snapshot);
        const { ids, pivot } = resolve(options, snapshot, fit);
        const placements = new Map(ids.length ? snapshot.doc.placements.map(p => [p.id, p] as const) : []);
        gesture = { pointer: event.pointerId, button: event.button, start, pose: cameraPose(), before: cameraPose(), fit, fitIds: fit ? transformTargets(snapshot.doc, [...new Set([...snapshot.selection, anchor(snapshot)].filter((id): id is string => !!id))], true, Infinity) : [], options: { ...options }, ids, pivot, rotation: new THREE.Quaternion(), dragged: false, constraint: {raw:{...start},point:{...start}},
          originals: ids.map(id => { const orientation = placements.get(id)?.orientation ?? identityRotation(); return { id, position: vector(snapshot.worlds.get(id)!), rotation: new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w), host: env.nodes()?.get(id) }; }) };
        if ((options.mode === "orient" || options.mode === "layout") && options.axis === "free") {
          const rect = env.canvas.getBoundingClientRect?.();
          if (rect && rect.width > 0 && rect.height > 0) {
            env.camera.updateMatrixWorld();
            const projected = pivot.clone().project(env.camera);
            const center = { x: rect.left + (projected.x + 1) * rect.width / 2, y: rect.top + (1 - projected.y) * rect.height / 2 };
            const box = new THREE.Box3();
            for (const original of gesture.originals) if (original.host) box.union(new THREE.Box3().setFromObject(original.host.group));
            let radius = 24;
            if (!box.isEmpty()) for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) {
              const corner = new THREE.Vector3(x,y,z).project(env.camera);
              radius = Math.max(radius, Math.max(Math.abs((corner.x-projected.x)*rect.width/2),Math.abs((corner.y-projected.y)*rect.height/2)));
            }
            if (Number.isFinite(radius) && Number.isFinite(center.x) && Number.isFinite(center.y)) gesture.trackball = { center, radius, frame: env.camera.quaternion.clone(), previous: trackballPoint(center,radius,start), rotation: new THREE.Quaternion() };
          }
        }
        env.enabled(false); env.canvas.setPointerCapture(event.pointerId); env.feedback(describe(options, ids, pivot)); show(options, pivot); return true;
      } catch (error) { env.feedback(error instanceof Error ? error.message : String(error)); return false; }
    },
    move(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.pointer) return false;
      if (gesture.blocked) return true;
      if (Math.hypot(event.clientX - gesture.start.x, event.clientY - gesture.start.y) < 5 && !gesture.dragged) return true;
      const point = constrainDrag(gesture.constraint, {x:event.clientX,y:event.clientY}, !!event.ctrlKey);
      const dx = point.x - gesture.start.x, dy = point.y - gesture.start.y;
      if (!gesture.dragged && gesture.fit) {
        const box = new THREE.Box3();
        for (const id of gesture.fitIds) {
          const host = env.nodes()?.get(id);
          if (host) box.union(new THREE.Box3().setFromObject(host.group));
        }
        if (!box.isEmpty()) {
          let radius = .5;
          for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) radius = Math.max(radius, gesture.pivot.distanceTo(new THREE.Vector3(x,y,z)));
          const vertical = THREE.MathUtils.degToRad(env.camera.getEffectiveFOV()) / 2;
          const halfFov = Math.min(vertical, Math.atan(Math.tan(vertical) * env.camera.aspect));
          const limits = env.distanceLimits?.() ?? { min: .01, max: Infinity };
          const distance = Math.max(limits.min, gesture.pose.position.distanceTo(gesture.pivot), radius / Math.sin(halfFov) * 1.1);
          if (distance > limits.max) { gesture.blocked = true; env.feedback("This branch exceeds the camera distance range."); return true; }
          const direction = gesture.pose.position.clone().sub(gesture.pose.target).normalize();
          gesture.pose.target.copy(gesture.pivot); gesture.pose.position.copy(gesture.pivot).addScaledVector(direction, distance);
          show(gesture.options, gesture.pivot);
        }
      }
      gesture.dragged = true;
      const { pose, options, pivot } = gesture;
      if (options.mode === "orient" || options.mode === "layout") {
        gesture.rotation.copy(gesture.trackball ? moveTrackball(gesture.trackball, point, options.speed, !!event.ctrlKey) : navigationRotation(pose, options, dx, dy, pivot));
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
        } else if (current.before.position.distanceToSquared(env.camera.position) + current.before.target.distanceToSquared(env.target()) + current.before.up.distanceToSquared(env.camera.up) > 1e-10) rememberView = true;
      }
      } finally {
      if (env.canvas.hasPointerCapture(current.pointer)) env.canvas.releasePointerCapture(current.pointer);
      marker.visible = false; env.enabled(true); env.rebind(); env.feedback(""); env.request();
      }
      if (rememberView) env.remember(current.before);
      return current.dragged;
    },
    dispose() { if (gesture) restore(gesture); gesture = null; env.scene.remove(marker); marker.geometry.dispose(); for (const material of Array.isArray(marker.material) ? marker.material : [marker.material]) material.dispose(); },
  };
}
