import * as THREE from "three";
import { MAX_STAR_DENSITY, effectSeed, effectVisible, fallingStar, perimeterPoint, resolveTargetSparkles, type EffectKind, type SparkleStyle } from "./graph/effects";
import type { WorkspaceSettings } from "./workspaceActions";
import type { TextScene } from "./textScene";

/** Bounded particle batches follow rendered geometry, never canonical layout. */
export function createStructuralSparkles(scene: THREE.Scene) {
  const maximum = 2048;
  const starCapacity = 720 * MAX_STAR_DENSITY;
  const batch = (capacity = maximum) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: false, blending: THREE.AdditiveBlending }));
    points.frustumCulled = false; points.userData.glowIntensity = 0.25; scene.add(points); return points;
  };
  const nodes = batch(), binders = batch(), background = batch(starCapacity), point = new THREE.Vector3(), color = new THREE.Color();
  // The original atmosphere's fixed seed and world-space distribution.
  // Reuse the existing background batch rather than adding another render loop.
  let randomSeed = 173;
  const random = () => { randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0; return randomSeed / 4294967296; };
  const starfield = new Float32Array(starCapacity * 3);
  const starTwinkles = new Float32Array(starCapacity * 2);
  for (let i = 0; i < starCapacity; i++) {
    const angle = random() * Math.PI * 2, z = random() * 2 - 1, radius = 12 + random() * 115;
    starfield.set([Math.cos(angle) * Math.sqrt(1 - z * z) * radius, z * radius, Math.sin(angle) * Math.sqrt(1 - z * z) * radius], i * 3);
    starTwinkles.set([effectSeed(`star-phase:${i}`) * Math.PI * 2, 2.5 + effectSeed(`star-speed:${i}`) * 4], i * 2);
  }
  nodes.name = "Node outline sparkles"; binders.name = "Binder path sparkles";
  background.name = "Background animation"; background.renderOrder = -1000;
  const configure = (points: typeof nodes, fx: SparkleStyle, active: boolean, texture: (kind: EffectKind) => THREE.Texture) => {
    points.visible = active && fx.effect !== "lightning" && fx.effect !== "electric-text" && effectVisible(fx);
    const map = texture(fx.effect);
    if (points.material.map !== map) { points.material.map = map; points.material.needsUpdate = true; }
    points.material.size = fx.effect === "starfield" ? 5 * (fx.starSize ?? 1) : fx.effect === "sparks" ? 9 : fx.effect === "dust" ? 3 : 5;
    points.material.opacity = fx.intensity;
  };
  const finish = (points: typeof nodes, count: number) => {
    points.geometry.setDrawRange(0, count);
    points.geometry.attributes.position.needsUpdate = points.geometry.attributes.color.needsUpdate = true;
  };
  const write = (points: typeof nodes, index: number, position: THREE.Vector3, tint: THREE.Color, intensity: number) => {
    points.geometry.attributes.position.setXYZ(index, position.x, position.y, position.z);
    points.geometry.attributes.color.setXYZ(index, tint.r * intensity, tint.g * intensity, tint.b * intensity);
  };
  return {
    update(theme: WorkspaceSettings["appearance"], source: TextScene | null, seconds: number, camera: THREE.PerspectiveCamera, texture: (kind: EffectKind) => THREE.Texture) {
      const nodeFx = resolveTargetSparkles(theme, "nodes"), binderFx = resolveTargetSparkles(theme, "binders"), backgroundFx = resolveTargetSparkles(theme, "background");
      const active = theme.theme === "neon" && theme.opacity > 0;
      configure(nodes, nodeFx, active, texture); configure(binders, binderFx, active, texture); configure(background, backgroundFx, active, texture);
      let count = 0;
      if (source && nodes.visible) for (const [id, item] of source.nodes) {
        if (!item.sprite.visible) continue;
        const seed = effectSeed(id), n = Math.ceil(nodeFx.density * 8), time = seconds * nodeFx.motion;
        color.set(nodeFx.color ?? item.color);
        for (let i = 0; i < n && count < maximum; i++) {
          const u = seed + i / n + time * 0.035;
          const snow = nodeFx.effect === "falling-stars", falling = fallingStar(seed, i, time);
          if (snow) {
            point.set((falling.x - 0.5) * (item.sprite.scale.x + 0.4), (0.5 - falling.y) * (item.sprite.scale.y + 0.4), item.depth / 2 + 0.05);
          } else if (item.sphere) {
            const angle = u * Math.PI * 2, latitude = Math.sin(seed * 17 + i * 2.4) * 0.8, radius = item.visualSize / 2 + 0.07;
            point.set(Math.cos(angle) * Math.sqrt(1 - latitude * latitude) * radius, latitude * radius, Math.sin(angle) * Math.sqrt(1 - latitude * latitude) * radius);
          } else {
            const width = item.sprite.scale.x + 0.12, height = item.sprite.scale.y + 0.12;
            const p = perimeterPoint(width, height, u); point.set(p.x - width / 2, p.y - height / 2, 0.025);
          }
          item.group.localToWorld(point);
          const twinkle = 0.45 + 0.55 * Math.pow((Math.sin(time * 2.5 + seed * 20 + i * 2) + 1) / 2, 2);
          write(nodes, count++, point, color, item.opacity * (snow ? falling.twinkle : twinkle));
        }
      }
      finish(nodes, count); count = 0;
      if (source && binders.visible) for (const item of source.connectors) {
        if (!item.path) continue;
        const seed = effectSeed(item.data.key), n = Math.ceil(binderFx.density * 7), time = seconds * binderFx.motion;
        if (binderFx.color) color.set(binderFx.color); else color.copy(item.line.material.color);
        for (let i = 0; i < n && count < maximum; i++) {
          const snow = binderFx.effect === "falling-stars", falling = fallingStar(seed, i, time);
          point.copy(item.path.getPoint((seed + i / n + (snow ? 0 : time * 0.06)) % 1));
          if (snow) { point.y += (0.5 - falling.y) * 1.2; point.x += (falling.x - 0.5) * 0.2; }
          point.z += Math.sin(seed * 20 + i + time) * 0.04;
          write(binders, count++, point, color, item.line.material.opacity * (snow ? falling.twinkle : 0.45 + 0.55 * (Math.sin(time * 3 + i * 2 + seed * 20) + 1) / 2));
        }
      }
      finish(binders, count); count = 0;
      if (background.visible && backgroundFx.effect === "starfield") {
        const time = seconds * backgroundFx.motion;
        background.position.set(0, 0, 0); background.rotation.set(0, time * 0.025, 0);
        background.material.size = 3 * (backgroundFx.starSize ?? 1);
        color.set(backgroundFx.color ?? theme.accent);
        const n = Math.round(720 * backgroundFx.density);
        for (let i = 0; i < n; i++) {
          point.fromArray(starfield, i * 3);
          const wave = (Math.sin(time * starTwinkles[i * 2 + 1] + starTwinkles[i * 2]) + 1) / 2;
          const twinkle = 0.12 + 0.88 * wave * wave * wave;
          write(background, count++, point, color, theme.opacity * twinkle);
        }
      } else if (background.visible) {
        // A camera-relative backdrop behind charted geometry, independent of atlas bounds.
        const depth = camera.far * 0.9, halfHeight = depth * Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV() / 2));
        background.position.copy(camera.position); background.quaternion.copy(camera.quaternion);
        color.set(backgroundFx.color ?? theme.accent);
        const time = seconds * backgroundFx.motion, n = Math.ceil(backgroundFx.density * 400);
        for (let i = 0; i < n; i++) {
          const seed = effectSeed(`background:${i}`), falling = fallingStar(seed, i, time);
          const snow = backgroundFx.effect === "falling-stars";
          point.set(((snow ? falling.x : seed) - 0.5) * 2 * halfHeight * camera.aspect, (0.5 - (snow ? falling.y : effectSeed(`background-y:${i}`))) * 2 * halfHeight, -depth);
          write(background, count++, point, color, theme.opacity * (snow ? falling.twinkle : 0.3 + 0.7 * (Math.sin(time * 2 + seed * 30) + 1) / 2));
        }
      }
      finish(background, count);
    },
    dispose() { for (const points of [nodes, binders, background]) { scene.remove(points); points.geometry.dispose(); points.material.dispose(); } },
  };
}
