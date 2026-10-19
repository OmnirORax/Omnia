import * as THREE from "three";
import { effectSeed, effectVisible, perimeterPoint, resolveSparkles, type EffectKind, type SparkleStyle } from "./graph/effects";
import type { WorkspaceSettings } from "./workspaceActions";
import type { TextScene } from "./textScene";

/** Two bounded particle batches follow rendered geometry, never canonical layout. */
export function createStructuralSparkles(scene: THREE.Scene) {
  const maximum = 2048;
  const batch = () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(maximum * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(maximum * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: false, blending: THREE.AdditiveBlending }));
    points.frustumCulled = false; points.userData.glowIntensity = 0.25; scene.add(points); return points;
  };
  const nodes = batch(), binders = batch(), point = new THREE.Vector3(), color = new THREE.Color();
  nodes.name = "Node outline sparkles"; binders.name = "Binder path sparkles";
  const configure = (points: typeof nodes, fx: SparkleStyle, active: boolean, texture: (kind: EffectKind) => THREE.Texture) => {
    points.visible = active && effectVisible(fx);
    const map = texture(fx.effect);
    if (points.material.map !== map) { points.material.map = map; points.material.needsUpdate = true; }
    points.material.size = fx.effect === "sparks" ? 9 : fx.effect === "dust" ? 3 : 5;
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
    update(theme: WorkspaceSettings["appearance"], source: TextScene | null, seconds: number, texture: (kind: EffectKind) => THREE.Texture) {
      const nodeFx = resolveSparkles(theme, theme.nodes.effects), binderFx = resolveSparkles(theme, theme.binders.effects);
      const active = theme.theme === "neon" && theme.opacity > 0;
      configure(nodes, nodeFx, active, texture); configure(binders, binderFx, active, texture);
      let count = 0;
      if (source && nodes.visible) for (const [id, item] of source.nodes) {
        if (!item.sprite.visible) continue;
        const seed = effectSeed(id), n = Math.ceil(nodeFx.density * 8), time = seconds * nodeFx.motion;
        color.set(item.color);
        for (let i = 0; i < n && count < maximum; i++) {
          const u = seed + i / n + time * 0.035;
          if (item.sphere) {
            const angle = u * Math.PI * 2, latitude = Math.sin(seed * 17 + i * 2.4) * 0.8, radius = item.visualSize / 2 + 0.07;
            point.set(Math.cos(angle) * Math.sqrt(1 - latitude * latitude) * radius, latitude * radius, Math.sin(angle) * Math.sqrt(1 - latitude * latitude) * radius);
          } else {
            const width = item.sprite.scale.x + 0.12, height = item.sprite.scale.y + 0.12;
            const p = perimeterPoint(width, height, u); point.set(p.x - width / 2, p.y - height / 2, 0.025);
          }
          item.group.localToWorld(point);
          const twinkle = 0.45 + 0.55 * Math.pow((Math.sin(time * 2.5 + seed * 20 + i * 2) + 1) / 2, 2);
          write(nodes, count++, point, color, item.opacity * twinkle);
        }
      }
      finish(nodes, count); count = 0;
      if (source && binders.visible) for (const item of source.connectors) {
        if (!item.path) continue;
        const seed = effectSeed(item.data.key), n = Math.ceil(binderFx.density * 7), time = seconds * binderFx.motion;
        color.copy(item.line.material.color);
        for (let i = 0; i < n && count < maximum; i++) {
          point.copy(item.path.getPoint((seed + i / n + time * 0.06) % 1));
          point.z += Math.sin(seed * 20 + i + time) * 0.04;
          write(binders, count++, point, color, item.line.material.opacity * (0.45 + 0.55 * (Math.sin(time * 3 + i * 2 + seed * 20) + 1) / 2));
        }
      }
      finish(binders, count);
    },
    dispose() { for (const points of [nodes, binders]) { scene.remove(points); points.geometry.dispose(); points.material.dispose(); } },
  };
}
