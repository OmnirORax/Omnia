import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Atlas } from "./graph/model";
import { projectSpatial, type XYZ } from "./graph/spatial";

type Props = {
  atlas: Atlas;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, local: XYZ) => void;
};

type SceneState = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  content: THREE.Group;
  requestRender: () => void;
  fit: () => void;
};

function labelSprite(text: string, color = "#e8eef7") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d")!;
  context.font = "600 40px system-ui, sans-serif";
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  let label = text || "Untitled";
  while (context.measureText(label).width > 470 && label.length > 2)
    label = `${label.slice(0, -2)}…`;
  context.fillText(label, 256, 64);
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
  sprite.renderOrder = 2;
  sprite.scale.set(2.25, 0.56, 1);
  return sprite;
}

function disposeContent(group: THREE.Group) {
  group.traverse((object) => {
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Line ||
      object instanceof THREE.Sprite
    ) {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material instanceof THREE.SpriteMaterial) material.map?.dispose();
        material.dispose();
      }
    }
  });
  group.clear();
}

export default function SpatialWorkspace({ atlas, selectedId, onSelect, onMove }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const sceneState = useRef<SceneState | null>(null);
  const callbacks = useRef({ onSelect, onMove });
  callbacks.current = { onSelect, onMove };
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const graph = projectSpatial(atlas);
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const draggable = useRef<THREE.Mesh[]>([]);
  const visibleGroups = useRef(new Map<string, THREE.Group>());
  const initialFit = useRef(false);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setError("3D rendering is unavailable in this browser. The 2D editor remains available.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x101927);
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101927);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 100000);
    camera.position.set(10, 9, 14);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.enablePan = true;
    controls.minDistance = 0.4;
    controls.maxDistance = 10000;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    const content = new THREE.Group();
    scene.add(content);
    scene.add(new THREE.AmbientLight(0xffffff, 2.2));
    const light = new THREE.DirectionalLight(0xffffff, 2.4);
    light.position.set(5, 12, 9);
    scene.add(light);
    const grid = new THREE.GridHelper(120, 60, 0x49637e, 0x27394f);
    grid.position.y = -4;
    scene.add(grid);
    let frame = 0;
    const requestRender = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        renderer.render(scene, camera);
      });
    };
    const fit = () => {
      const points = graphRef.current.nodes
        .filter((n) => n.visible)
        .map((n) => new THREE.Vector3(n.world.x, n.world.y, n.world.z));
      if (!points.length) {
        camera.position.set(10, 9, 14);
        controls.target.set(0, 0, 0);
      } else {
        const bounds = new THREE.Box3().setFromPoints(points);
        const center = bounds.getCenter(new THREE.Vector3());
        const span = Math.max(4.5, bounds.getSize(new THREE.Vector3()).length());
        controls.target.copy(center);
        camera.position.copy(center).add(new THREE.Vector3(span * 1.25, span * 0.9, span * 1.35));
        camera.near = Math.max(0.01, span / 1000);
        camera.far = Math.max(1000, span * 100);
        camera.updateProjectionMatrix();
      }
      controls.update();
      requestRender();
    };
    sceneState.current = { scene, camera, renderer, controls, content, requestRender, fit };
    const resize = () => {
      const width = Math.max(1, host.clientWidth),
        height = Math.max(1, host.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      requestRender();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    controls.addEventListener("change", requestRender);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const hits = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(draggable.current, false);
    };
    let dragging: {
      id: string;
      group: THREE.Group;
      plane: THREE.Plane;
      offset: THREE.Vector3;
      startX: number;
      startY: number;
      startWorld: THREE.Vector3;
    } | null = null;
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const hit = hits(event)[0];
      if (!hit) return;
      const id = hit.object.userData.nodeId as string;
      const group = visibleGroups.current.get(id);
      if (!group) return;
      const normal = camera.getWorldDirection(new THREE.Vector3());
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, group.position);
      const intersection = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      if (!intersection) return;
      dragging = {
        id,
        group,
        plane,
        offset: group.position.clone().sub(intersection),
        startX: event.clientX,
        startY: event.clientY,
        startWorld: group.position.clone(),
      };
      controls.enabled = false;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!dragging) return;
      hits(event);
      const intersection = raycaster.ray.intersectPlane(dragging.plane, new THREE.Vector3());
      if (intersection) {
        dragging.group.position.copy(intersection.add(dragging.offset));
        requestRender();
      }
    };
    const up = (event: PointerEvent) => {
      if (!dragging) return;
      const drag = dragging;
      dragging = null;
      controls.enabled = true;
      if (renderer.domElement.hasPointerCapture(event.pointerId))
        renderer.domElement.releasePointerCapture(event.pointerId);
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 4) {
        drag.group.position.copy(drag.startWorld);
        callbacks.current.onSelect(drag.id);
      } else {
        const node = graphRef.current.nodes.find((n) => n.id === drag.id)!;
        const parent = graphRef.current.nodes.find((n) => n.id === node.parentId);
        callbacks.current.onMove(drag.id, {
          x: drag.group.position.x - (parent?.world.x ?? 0),
          y: drag.group.position.y - (parent?.world.y ?? 0),
          z: drag.group.position.z - (parent?.world.z ?? 0),
        });
      }
      requestRender();
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    setReady(true);
    return () => {
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up);
      observer.disconnect();
      controls.dispose();
      cancelAnimationFrame(frame);
      disposeContent(content);
      renderer.dispose();
      renderer.domElement.remove();
      sceneState.current = null;
    };
  }, []);

  useEffect(() => {
    const state = sceneState.current;
    if (!state || !ready) return;
    disposeContent(state.content);
    draggable.current = [];
    visibleGroups.current = new Map();
    const visible = graph.nodes.filter((n) => n.visible);
    for (const node of visible) {
      const group = new THREE.Group();
      group.position.set(node.world.x, node.world.y, node.world.z);
      const material = new THREE.MeshStandardMaterial({
        color: selectedId === node.id ? 0x4778c6 : 0x294363,
        roughness: 0.65,
        metalness: 0.12,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 0.42), material);
      mesh.userData.nodeId = node.id;
      group.add(mesh);
      const label = labelSprite(node.label);
      label.position.y = 0.1;
      group.add(label);
      state.content.add(group);
      draggable.current.push(mesh);
      visibleGroups.current.set(node.id, group);
    }
    for (const node of visible) {
      const descendants = visible.filter(
        (child) =>
          child.id !== node.id &&
          (() => {
            let parentId = child.parentId;
            while (parentId) {
              if (parentId === node.id) return true;
              parentId =
                graph.nodes.find((candidate) => candidate.id === parentId)?.parentId ?? null;
            }
            return false;
          })(),
      );
      if (!descendants.length) continue;
      const bounds = new THREE.Box3().setFromPoints(
        [node, ...descendants].map(
          (item) => new THREE.Vector3(item.world.x, item.world.y, item.world.z),
        ),
      );
      const size = bounds.getSize(new THREE.Vector3()).add(new THREE.Vector3(3.2, 1.7, 2.2));
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(size.x, size.y, size.z),
        new THREE.MeshBasicMaterial({
          color: 0x6b9bd7,
          transparent: true,
          opacity: 0.07,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      box.position.copy(bounds.getCenter(new THREE.Vector3()));
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(box.geometry),
        new THREE.LineBasicMaterial({ color: 0x6b9bd7, transparent: true, opacity: 0.55 }),
      );
      outline.position.copy(box.position);
      state.content.add(box, outline);
    }
    for (const relationship of graph.relationships) {
      const from = graph.nodes.find((node) => node.id === relationship.source)!;
      const to = graph.nodes.find((node) => node.id === relationship.target)!;
      if (from.id === to.id) {
        const loop = new THREE.Mesh(
          new THREE.TorusGeometry(0.47, 0.025, 6, 32, Math.PI * 1.7),
          new THREE.MeshBasicMaterial({ color: 0x8fb4dc, side: THREE.DoubleSide }),
        );
        loop.position.set(from.world.x + 1.25, from.world.y + 0.3, from.world.z);
        state.content.add(loop);
        continue;
      }
      const start = new THREE.Vector3(from.world.x, from.world.y, from.world.z);
      const end = new THREE.Vector3(to.world.x, to.world.y, to.world.z);
      const direction = end.clone().sub(start);
      const length = direction.length();
      if (length < 0.01) continue;
      const arrow = new THREE.ArrowHelper(
        direction.normalize(),
        start,
        Math.max(0.1, length - 0.85),
        relationship.projected ? 0xe0a86c : 0x8fb4dc,
        0.3,
        0.15,
      );
      state.content.add(arrow);
      if (relationship.label) {
        const label = labelSprite(relationship.label, "#f2c58f");
        label.scale.set(1.5, 0.37, 1);
        label.position.copy(start.clone().lerp(end, 0.5)).add(new THREE.Vector3(0, 0.35, 0));
        state.content.add(label);
      }
    }
    state.requestRender();
    if (!initialFit.current && visible.length) {
      state.fit();
      initialFit.current = true;
    }
  }, [atlas, selectedId, ready]);

  return (
    <div className="spatial-workspace" aria-label="3D Omnium workspace">
      <div ref={mount} className="spatial-canvas" />
      {error ? (
        <div className="spatial-error" role="alert">
          {error}
        </div>
      ) : (
        <div className="spatial-help">
          Drag empty space to rotate · right-drag to pan · scroll to zoom · drag a node to move it ·
          edit XYZ in the inspector
        </div>
      )}
      <button className="spatial-fit" onClick={() => sceneState.current?.fit()}>
        Fit 3D view
      </button>
    </div>
  );
}
