import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { contour, imageContours, lightningBolts, type Contour } from "./lightning";
import { effectSeed, effectVisible, resolveTargetSparkles, type SparkleStyle } from "./graph/effects";
import type { WorkspaceSettings } from "./workspaceActions";
import type { TextScene } from "./textScene";

/** Fixed-size line batches; all contours stay private to the renderer. */
export function createSceneLightning(scene: THREE.Scene) {
  const maximum = 4096, positions = new Float32Array(maximum * 6), colors = new Float32Array(maximum * 6);
  const geometry = new LineSegmentsGeometry(); geometry.setPositions(positions); geometry.setColors(colors); geometry.instanceCount = 0;
  const material = new LineMaterial({ linewidth: 1.1, vertexColors: true, transparent: true, depthWrite: false, alphaToCoverage: true, blending: THREE.AdditiveBlending });
  const haloMaterial = material.clone(); haloMaterial.linewidth = 3.2; haloMaterial.opacity = 0.16;
  const halo = new LineSegments2(geometry, haloMaterial), core = new LineSegments2(geometry, material);
  halo.name = "Lightning halo"; core.name = "Contour lightning";
  for (const object of [halo, core]) { object.frustumCulled = false; object.userData.glowIntensity = 0.55; scene.add(object); }
  halo.renderOrder = 3; core.renderOrder = 4;
  const backgroundPositions = new Float32Array(192 * 6), backgroundColors = new Float32Array(192 * 6);
  const backgroundGeometry = new LineSegmentsGeometry(); backgroundGeometry.setPositions(backgroundPositions); backgroundGeometry.setColors(backgroundColors); backgroundGeometry.instanceCount = 0;
  const backgroundMaterial = material.clone(); backgroundMaterial.linewidth = 0.8;
  const background = new LineSegments2(backgroundGeometry, backgroundMaterial); background.name = "Background lightning";
  background.frustumCulled = false; background.renderOrder = -1000; scene.add(background);
  const cache = new WeakMap<THREE.Mesh, { image: unknown; paths: Contour[] }>();
  const point = new THREE.Vector3(), previous = new THREE.Vector3(), tint = new THREE.Color(), white = new THREE.Color("white"), matrix = new THREE.Matrix4();
  const frustum = new THREE.Frustum(), bounds = new THREE.Sphere();
  const circle = [contour(Array.from({ length: 65 }, (_, i) => ({ x: Math.cos(i / 64 * Math.PI * 2) * 0.53, y: Math.sin(i / 64 * Math.PI * 2) * 0.53 })), 64, 64)];
  const triangle = [contour([{ x: 0, y: 0.5 }, { x: 1, y: -0.5 }, { x: -1, y: -0.5 }, { x: 0, y: 0.5 }], 64, 64)];
  let count = 0, backgroundCount = 0;
  const pathsFor = (object: THREE.Mesh) => {
    if (object.geometry instanceof THREE.ConeGeometry) return triangle;
    if (object.geometry instanceof THREE.SphereGeometry) return circle;
    if (!(object.geometry instanceof THREE.PlaneGeometry)) return [];
    const surface = Array.isArray(object.material) ? object.material[0] : object.material;
    const image = "map" in surface ? (surface.map as THREE.Texture | null)?.image : undefined;
    const mask = object.userData.lightningMask as (() => HTMLCanvasElement) | undefined;
    if (!mask && !image) return [];
    const cached = cache.get(object); if (cached && cached.image === image) return cached.paths;
    const source = (mask ? mask() : image) as (CanvasImageSource & { width?: number; naturalWidth?: number }) | undefined;
    if (!source?.width && !source?.naturalWidth) return [];
    const paths = imageContours(source); cache.set(object, { image, paths }); return paths;
  };
  const segment = (a: THREE.Vector3, b: THREE.Vector3, color: THREE.Color, strength: number, backdrop = false) => {
    if (backdrop ? backgroundCount >= 192 : count >= maximum) return;
    const offset = (backdrop ? backgroundCount++ : count++) * 6;
    (backdrop ? backgroundPositions : positions).set([a.x, a.y, a.z, b.x, b.y, b.z], offset);
    const value = tint.copy(color).lerp(white, 0.15 + strength * 0.35).multiplyScalar(strength);
    (backdrop ? backgroundColors : colors).set([value.r, value.g, value.b, value.r, value.g, value.b], offset);
  };
  return {
    update(theme: WorkspaceSettings["appearance"], source: TextScene | null, seconds: number, camera: THREE.PerspectiveCamera, width: number, height: number, reduced: boolean) {
      count = backgroundCount = 0; material.resolution.set(width, height); haloMaterial.resolution.copy(material.resolution); backgroundMaterial.resolution.copy(material.resolution);
      frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const active = theme.theme === "neon" && theme.opacity > 0;
      const drawObject = (object: THREE.Object3D, fx: SparkleStyle, color: string | THREE.Color, opacity: number, seed: number) => {
        if (!object.visible || count >= maximum) return;
        if (object instanceof THREE.Mesh) {
          object.updateWorldMatrix(true, false);
          if (!object.geometry.boundingSphere) object.geometry.computeBoundingSphere();
          bounds.copy(object.geometry.boundingSphere!).applyMatrix4(object.matrixWorld);
          // Extract/cache contours only when the representation is visible and large enough to read.
          if (!frustum.intersectsSphere(bounds) || bounds.radius * height / Math.max(0.01, camera.position.distanceTo(bounds.center)) < 2) return;
          const paths = pathsFor(object);
          if (paths.length) {
            object.updateWorldMatrix(true, false); matrix.copy(object.matrixWorld);
            if (object.geometry instanceof THREE.SphereGeometry) {
              matrix.compose(object.getWorldPosition(new THREE.Vector3()), camera.quaternion, object.getWorldScale(new THREE.Vector3()));
            }
            const bolts = lightningBolts(paths, seed, seconds * fx.motion, fx.density, fx.boltLength, !reduced && fx.motion > 0);
            const base = new THREE.Color(fx.color ?? object.userData.textColor ?? color);
            for (const bolt of bolts) {
              for (let i = 0; i < bolt.points.length; i++) {
                const p = bolt.points[i]; point.set(p.x, p.y, 0.015).applyMatrix4(matrix);
                if (i) segment(previous, point, base, bolt.strength * fx.intensity * opacity);
                previous.copy(point);
              }
            }
          }
        }
        for (let i = 0; i < object.children.length && count < maximum; i++) drawObject(object.children[i], fx, color, opacity, seed + i * 0.137);
      };
      const nodeFx = resolveTargetSparkles(theme, "nodes"), binderFx = resolveTargetSparkles(theme, "binders"), backgroundFx = resolveTargetSparkles(theme, "background");
      if (active && source && nodeFx.effect === "lightning" && effectVisible(nodeFx)) for (const [id, node] of source.nodes) {
        if (!node.sprite.visible || count >= maximum) continue;
        const seed = effectSeed(id);
        if (node.text.visible) drawObject(node.text, nodeFx, node.color, node.opacity, seed);
        if (node.visual) drawObject(node.visual, nodeFx, node.color, node.opacity, seed + 0.31);
        if (node.sphere) drawObject(node.sprite, nodeFx, node.color, node.opacity, seed);
      }
      if (active && source && binderFx.effect === "lightning" && effectVisible(binderFx)) for (const binder of source.connectors) {
        if (count >= maximum) break;
        const seed = effectSeed(binder.data.key), color = binder.line.material.color, opacity = binder.line.material.opacity;
        drawObject(binder.arrow, binderFx, color, opacity, seed);
        if (binder.label?.visible) drawObject(binder.label, binderFx, color, binder.textOpacity, seed + 0.17);
        if (binder.path) {
          const time = seconds * binderFx.motion, start = (seed + time * 0.08) % 0.8;
          const strength = reduced || binderFx.motion === 0 ? 0.15 : 0.12 + Math.pow(Math.max(0, Math.sin(time * 14 + seed * 20)), 16) * 0.8;
          const base = new THREE.Color(binderFx.color ?? color);
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
          for (let i = 0; i <= 16; i++) {
            point.copy(binder.path.getPoint(Math.min(1, start + i / 16 * (0.04 + (binderFx.boltLength ?? 0.35) * 0.3))));
            point.addScaledVector(right, Math.sin(i * 6.3 + Math.floor(time * 24)) * 0.025 * Math.sin(i / 16 * Math.PI));
            if (i) segment(previous, point, base, strength * binderFx.intensity * opacity * binderFx.density);
            previous.copy(point);
          }
        }
      }
      if (active && backgroundFx.effect === "lightning" && effectVisible(backgroundFx)) {
        const depth = camera.far * 0.9, halfHeight = depth * Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV() / 2));
        const backdrop = new THREE.Matrix4().compose(camera.position, camera.quaternion, new THREE.Vector3(halfHeight * camera.aspect, halfHeight, 1));
        const time = seconds * backgroundFx.motion, frame = Math.floor(time * 12), base = new THREE.Color(backgroundFx.color ?? theme.accent);
        // Sparse, distant forks; confined to their own background target.
        for (let j = 0; j < Math.ceil(backgroundFx.density * 4); j++) {
          const seed = effectSeed(`sky:${j}:${Math.floor(time)}`), strength = reduced || backgroundFx.motion === 0 ? 0.1 : Math.pow(Math.max(0, Math.sin(time * 8 + j * 17)), 32) * 0.7;
          for (let i = 0; i <= 12; i++) {
            point.set((seed - 0.5) * 1.8 + Math.sin(i * 14 + frame) * 0.025, 0.9 - i / 12 * (0.15 + (backgroundFx.boltLength ?? 0.35) * 0.6), -depth).applyMatrix4(backdrop);
            if (i) segment(previous, point, base, strength * backgroundFx.intensity * theme.opacity, true);
            previous.copy(point);
          }
        }
      }
      geometry.instanceCount = count;
      (geometry.attributes.instanceStart as THREE.InterleavedBufferAttribute).data.needsUpdate = true;
      (geometry.attributes.instanceColorStart as THREE.InterleavedBufferAttribute).data.needsUpdate = true;
      halo.visible = core.visible = count > 0;
      backgroundGeometry.instanceCount = backgroundCount; background.visible = backgroundCount > 0;
      (backgroundGeometry.attributes.instanceStart as THREE.InterleavedBufferAttribute).data.needsUpdate = true;
      (backgroundGeometry.attributes.instanceColorStart as THREE.InterleavedBufferAttribute).data.needsUpdate = true;
    },
    dispose() { scene.remove(halo, core, background); geometry.dispose(); material.dispose(); haloMaterial.dispose(); backgroundGeometry.dispose(); backgroundMaterial.dispose(); },
  };
}
