import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { prepareWorld, sameOrigin, type Origin, type Structure, type Vec3, type World } from './core/model.ts';

type Point = { x: number; y: number };
type Input = { pick: (origin: Origin, extend: boolean, toggle: boolean) => void;
  range: (origins: Origin[], extend: boolean) => void; clear: () => void;
  menu: (origin: Origin | undefined, point: Point, position: Vec3) => void;
  move: (origins: readonly Origin[], delta: Vec3) => void;
  feedback: (message: string) => void; picking: () => boolean };
type Visual = { node: Structure; group: T.Group; body: T.Mesh<T.SphereGeometry, T.MeshStandardMaterial>; ring: T.Mesh; text: T.Sprite; caption: string };
const key = (origin: Origin) => JSON.stringify(origin);
const xyz = (v: T.Vector3): Vec3 => [v.x, v.y, v.z];

export function createWorld(host: HTMLElement, input: Input) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor('#101113');
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'Omnium 3D world. Drag empty space to pan, right-drag to orbit, scroll to zoom.');
  host.append(renderer.domElement);
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(45, 1, .1, 10000);
  camera.position.set(12, 8, 40);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false; controls.minDistance = 3; controls.maxDistance = 3000;
  controls.mouseButtons = { LEFT: T.MOUSE.PAN, MIDDLE: T.MOUSE.DOLLY, RIGHT: T.MOUSE.ROTATE };
  controls.update();
  scene.add(new T.HemisphereLight('#ffffff', '#242728', 2));
  const light = new T.DirectionalLight('#ffffff', 3); light.position.set(10, 20, 40); scene.add(light);
  const sphere = new T.SphereGeometry(.65, 20, 14), ringGeometry = new T.RingGeometry(.94, 1.04, 40);
  const ringMaterial = new T.MeshBasicMaterial({ color: '#f0f1df', side: T.DoubleSide, depthTest: false });
  const visuals = new Map<string, Visual>(), ray = new T.Raycaster();
  let world: World, selected: readonly Origin[] = [], filter: ReadonlySet<string> | undefined;
  let prepared: ReturnType<typeof prepareWorld>;
  let frame = 0;
  const edges = new T.Group(); scene.add(edges);
  const rectangle = document.createElement('div'); rectangle.className = 'marquee'; rectangle.hidden = true; host.append(rectangle);
  const direction = new T.Vector3(), hit = new T.Vector3();
  function request() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      for (const visual of visuals.values()) visual.ring.quaternion.copy(camera.quaternion);
      renderer.render(scene, camera);
    });
  }
  controls.addEventListener('change', request);
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); request();
  }); resize.observe(host);
  function pointer(point: Point) {
    const rect = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2((point.x - rect.left) / rect.width * 2 - 1, -(point.y - rect.top) / rect.height * 2 + 1), camera);
  }
  function pointed(point: Point) {
    pointer(point);
    const objects: T.Object3D[] = [];
    for (const visual of visuals.values()) if (visual.group.visible) objects.push(visual.body, visual.text);
    return ray.intersectObjects(objects, false)[0]?.object.userData.origin as Origin | undefined;
  }
  function at(point: Point, anchor = controls.target) {
    pointer(point); camera.getWorldDirection(direction);
    ray.ray.intersectPlane(new T.Plane().setFromNormalAndCoplanarPoint(direction, anchor), hit);
    return hit.clone();
  }
  function label(caption: string) {
    const canvas = document.createElement('canvas');
    const lines = caption.match(/.{1,28}(?:\s|$)|.{1,28}/gu) ?? ['●'];
    const context = canvas.getContext('2d')!;
    context.font = '32px system-ui';
    canvas.width = Math.max(64, Math.ceil(Math.max(...lines.map(line => context.measureText(line.trim()).width))) + 24);
    canvas.height = Math.max(80, lines.length * 48 + 24);
    context.font = '32px system-ui'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillStyle = '#eeeee8'; context.shadowColor = '#101113'; context.shadowBlur = 8;
    lines.forEach((line, i) => context.fillText(line.trim(), canvas.width / 2, 36 + i * 48));
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.set(canvas.width / 52, canvas.height / 52, 1); sprite.position.y = -1.1 - sprite.scale.y / 2;
    return sprite;
  }
  function disposeLabel(text: T.Sprite) { text.material.map?.dispose(); text.material.dispose(); }
  function clearEdges() {
    for (const child of [...edges.children]) {
      const line = child as T.Line; line.geometry?.dispose();
      if (line.material) for (const material of Array.isArray(line.material) ? line.material : [line.material]) material.dispose();
      edges.remove(child);
    }
  }
  function connections() {
    clearEdges();
    for (const node of world.nodes) node.parts.forEach(binding => {
      for (const target of prepared.resolve(binding)) {
        if (!selected.some(origin => sameOrigin(origin, node.origin) || sameOrigin(origin, target.origin))) continue;
        if (!visuals.get(key(node.origin))?.group.visible || !visuals.get(key(target.origin))?.group.visible) continue;
        const a = new T.Vector3(...node.position), b = new T.Vector3(...target.position);
        const delta = b.clone().sub(a), length = delta.length(); if (length < 1.5) continue;
        delta.normalize(); a.addScaledVector(delta, 1.05); b.addScaledVector(delta, -1.05);
        const line = new T.Line(new T.BufferGeometry().setFromPoints([a, b]), new T.LineBasicMaterial({ color: binding.mode === 'structure' ? '#c4cb9b' : '#657175' }));
        edges.add(line);
        // Arrowhead is actual world geometry, shared by every reference mode.
        const side = delta.clone().cross(camera.position.clone().sub(b)).normalize().multiplyScalar(.35);
        const back = b.clone().addScaledVector(delta, -.8);
        edges.add(new T.Line(new T.BufferGeometry().setFromPoints([back.clone().add(side), b, back.clone().sub(side)]), new T.LineBasicMaterial({ color: '#9ca59a' })));
      }
    });
  }
  function update(next: World, selection: readonly Origin[], visible?: ReadonlySet<string>) {
    if (world !== next) prepared = prepareWorld(next);
    world = next; selected = selection; filter = visible;
    const present = new Set(next.nodes.map(node => key(node.origin)));
    for (const [id, visual] of visuals) if (!present.has(id)) {
      scene.remove(visual.group); visual.body.material.dispose(); disposeLabel(visual.text); visuals.delete(id);
    }
    for (const node of next.nodes) {
      const id = key(node.origin), caption = `${node.invariant ? '⚬' : '●'}${node.label ? ` ${node.label}` : ''}${node.parts.length ? ` · ${node.parts.length}` : ''}${node.parts.some(binding => !prepared.resolve(binding).length) ? ' !' : ''}`;
      let visual = visuals.get(id);
      if (!visual) {
        const group = new T.Group(), body = new T.Mesh(sphere, new T.MeshStandardMaterial({ roughness: .45, metalness: .08 }));
        const ring = new T.Mesh(ringGeometry, ringMaterial), text = label(caption); ring.renderOrder = 1;
        group.add(body, ring, text); scene.add(group); visual = { node, group, body, ring, text, caption }; visuals.set(id, visual);
      }
      if (visual.caption !== caption) {
        visual.group.remove(visual.text); disposeLabel(visual.text); visual.text = label(caption); visual.group.add(visual.text); visual.caption = caption;
      }
      visual.node = node; visual.group.position.set(...node.position); visual.body.material.color.set(node.color);
      visual.ring.visible = selection.some(origin => sameOrigin(origin, node.origin));
      visual.group.visible = !filter || filter.has(id);
      visual.body.userData.origin = node.origin; visual.text.userData.origin = node.origin;
    }
    connections(); request();
  }

  type Gesture = { pointer: number; start: Point; end: Point; origin?: Origin; position: T.Vector3; originals: Map<string, T.Vector3>; mode: 'move' | 'range' | 'view'; extend: boolean; dragged: boolean };
  let gesture: Gesture | undefined;
  const canvas = renderer.domElement;
  function restore() {
    if (!gesture) return;
    for (const [id, position] of gesture.originals) visuals.get(id)?.group.position.copy(position);
    gesture = undefined; rectangle.hidden = true; controls.enabled = true; request();
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 && event.button !== 2) return;
    const point = { x: event.clientX, y: event.clientY }, origin = pointed(point);
    const range = event.button === 0 && (event.shiftKey || event.ctrlKey || event.metaKey);
    const moving = event.button === 0 && !!origin && !range && !input.picking();
    const originals = new Map<string, T.Vector3>();
    if (moving) {
      if (!selected.some(value => sameOrigin(value, origin!))) input.pick(origin!, false, false);
      for (const visual of visuals.values()) if (selected.some(value => sameOrigin(value, visual.node.origin))) originals.set(key(visual.node.origin), visual.group.position.clone());
    }
    const anchor = origin ? visuals.get(key(origin))!.group.position : controls.target;
    gesture = { pointer: event.pointerId, start: point, end: point, origin, position: at(point, anchor), originals, mode: moving ? 'move' : range ? 'range' : 'view', extend: range, dragged: false };
    if (moving || range) { controls.enabled = false; event.stopImmediatePropagation(); canvas.setPointerCapture(event.pointerId); }
  }, true);
  canvas.addEventListener('pointermove', event => {
    const g = gesture; if (!g || g.pointer !== event.pointerId) return;
    g.end = { x: event.clientX, y: event.clientY };
    g.dragged ||= Math.hypot(g.end.x - g.start.x, g.end.y - g.start.y) >= 4;
    if (!g.dragged) return;
    if (g.mode === 'move') {
      const delta = at(g.end, g.position).sub(g.position);
      for (const [id, before] of g.originals) visuals.get(id)?.group.position.copy(before).add(delta);
      edges.visible = false; request();
    } else if (g.mode === 'range') {
      rectangle.hidden = false;
      Object.assign(rectangle.style, { left: `${Math.min(g.start.x, g.end.x)}px`, top: `${Math.min(g.start.y, g.end.y)}px`, width: `${Math.abs(g.end.x - g.start.x)}px`, height: `${Math.abs(g.end.y - g.start.y)}px` });
    }
  });
  canvas.addEventListener('pointerup', event => {
    const g = gesture; if (!g || g.pointer !== event.pointerId) return;
    gesture = undefined; rectangle.hidden = true; controls.enabled = true; edges.visible = true;
    if (g.dragged && g.mode === 'move') {
      const delta = at(g.end, g.position).sub(g.position);
      try { input.move([...g.originals.keys()].map(id => visuals.get(id)!.node.origin), xyz(delta)); }
      catch (error) { for (const [id, before] of g.originals) visuals.get(id)?.group.position.copy(before); input.feedback(String(error instanceof Error ? error.message : error)); }
    } else if (g.dragged && g.mode === 'range') {
      const rect = canvas.getBoundingClientRect(), origins: Origin[] = [];
      for (const visual of visuals.values()) {
        if (!visual.group.visible) continue;
        const p = visual.group.position.clone().project(camera);
        const x = rect.left + (p.x + 1) / 2 * rect.width, y = rect.top + (1 - p.y) / 2 * rect.height;
        if (p.z >= -1 && p.z <= 1 && x >= Math.min(g.start.x, g.end.x) && x <= Math.max(g.start.x, g.end.x) && y >= Math.min(g.start.y, g.end.y) && y <= Math.max(g.start.y, g.end.y)) origins.push(visual.node.origin);
      }
      input.range(origins, g.extend);
    } else if (!g.dragged && event.button === 2) {
      input.menu(g.origin, g.end, xyz(at(g.end)));
    } else if (!g.dragged && event.button === 0) {
      if (g.origin) input.pick(g.origin, event.shiftKey, event.ctrlKey || event.metaKey); else input.clear();
    }
    request();
  });
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('pointercancel', () => { restore(); edges.visible = true; });
  canvas.addEventListener('lostpointercapture', () => { if (gesture?.mode !== 'view') restore(); edges.visible = true; });
  window.addEventListener('blur', () => { restore(); edges.visible = true; });
  return { update, point: (point: Point) => xyz(at(point)), center: () => xyz(controls.target), request,
    cancel() { const active = !!gesture; restore(); edges.visible = true; return active; },
    focus(origins: readonly Origin[]) {
      const points = origins.map(origin => visuals.get(key(origin))?.group.position).filter((p): p is T.Vector3 => !!p);
      if (!points.length) return;
      const center = points.reduce((sum, p) => sum.add(p), new T.Vector3()).divideScalar(points.length);
      const shift = center.clone().sub(controls.target); camera.position.add(shift); controls.target.copy(center); controls.update(); request();
    },
  };
}
