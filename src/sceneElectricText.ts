import * as THREE from "three";
import { createElectricInk } from "./electricInk";
import { effectSeed, effectVisible, type SparkleStyle } from "./graph/effects";
import type { WorkspaceSettings } from "./workspaceActions";
import { graphEffectItems } from "./appearance/graphEffects";
import { effectsFor } from "./appearance/resolve";
import type { TextScene } from "./textScene";

/** One moving ink texture per category, sampled inside each glyph's alpha mask on the GPU. */
export function createSceneElectricText() {
  const frustum = new THREE.Frustum(),
    bounds = new THREE.Sphere(),
    projection = new THREE.Matrix4();
  const patterns = Object.fromEntries(
    ["text.nodes", "text.binders", "symbols.nodes", "symbols.binders"].map((id) => [
      id,
      createElectricInk(),
    ]),
  );
  const textures = Object.fromEntries(
    Object.entries(patterns).map(([key, pattern]) => {
      const texture = new THREE.CanvasTexture(pattern.canvas);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      return [key, texture];
    }),
  ) as Record<keyof typeof patterns, THREE.CanvasTexture>;
  const states = new WeakMap<THREE.Mesh, ReturnType<typeof configure>>();
  const resources = new Set<{ dispose: () => void; uniforms: ReturnType<typeof uniformsFor> }>();
  function uniformsFor(mask: THREE.Texture, width: number, height: number) {
    return {
      omniumInk: { value: textures["text.nodes"] as THREE.Texture },
      omniumGlyph: { value: mask },
      omniumInkColor: { value: new THREE.Color() },
      omniumInkStrength: { value: 0 },
      omniumInkScale: { value: new THREE.Vector2(width / 100, height / 100) },
      omniumInkSeed: { value: 0 },
    };
  }
  function configure(mesh: THREE.Mesh, material: THREE.MeshBasicMaterial) {
    const factory = mesh.userData.lightningMask as (() => HTMLCanvasElement) | undefined;
    const mask = factory ? new THREE.CanvasTexture(factory()) : material.map!;
    const image = mask.image as { width?: number; height?: number };
    const uniforms = uniformsFor(mask, image.width || 128, image.height || 128);
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader =
        `uniform sampler2D omniumInk;
        uniform sampler2D omniumGlyph;
        uniform vec3 omniumInkColor;
        uniform float omniumInkStrength;
        uniform vec2 omniumInkScale;
        uniform float omniumInkSeed;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        #ifdef USE_MAP
          float glyph = texture2D(omniumGlyph, vMapUv).a;
          float flux = texture2D(omniumInk, vMapUv * omniumInkScale + vec2(omniumInkSeed)).r;
          float core = smoothstep(0.68, 0.98, flux);
          vec3 electricInk = omniumInkColor * (0.16 + flux * 1.25) + vec3(core * 0.9);
          electricInk *= 0.35 + omniumInkStrength * 0.65;
          diffuseColor.rgb = mix(diffuseColor.rgb, electricInk, glyph * step(0.001, omniumInkStrength));
        #endif`,
      );
    };
    material.customProgramCacheKey = () => "omnium-electric-ink-v1";
    material.needsUpdate = true;
    const state = {
      uniforms,
      dispose: () => {
        if (factory) mask.dispose();
        resources.delete(state);
        material.removeEventListener("dispose", state.dispose);
      },
    };
    material.addEventListener("dispose", state.dispose);
    resources.add(state);
    return state;
  }
  return {
    update(
      theme: WorkspaceSettings["appearance"],
      source: TextScene | null,
      seconds: number,
      camera: THREE.PerspectiveCamera,
      reduced: boolean,
    ) {
      for (const state of resources) state.uniforms.omniumInkStrength.value = 0;
      if (!source || theme.theme !== "neon" || theme.opacity === 0) return;
      frustum.setFromProjectionMatrix(
        projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
      );
      const apply = (
        root: THREE.Object3D,
        fx: SparkleStyle,
        texture: THREE.Texture,
        color: string | THREE.Color,
        seed: number,
      ) => {
        if (!root.visible) return;
        if (
          root instanceof THREE.Mesh &&
          root.geometry instanceof THREE.PlaneGeometry &&
          root.material instanceof THREE.MeshBasicMaterial &&
          root.material.map
        ) {
          root.updateWorldMatrix(true, false);
          if (!root.geometry.boundingSphere) root.geometry.computeBoundingSphere();
          bounds.copy(root.geometry.boundingSphere!).applyMatrix4(root.matrixWorld);
          if (!frustum.intersectsSphere(bounds)) return;
          let state = states.get(root);
          if (!state) {
            state = configure(root, root.material);
            states.set(root, state);
          }
          const uniforms = state.uniforms;
          uniforms.omniumInk.value = texture;
          uniforms.omniumInkStrength.value = fx.intensity * (fx.opacity ?? 1);
          uniforms.omniumInkColor.value.set(fx.color ?? root.userData.textColor ?? color);
          uniforms.omniumInkSeed.value = seed;
        }
        for (const child of root.children) apply(child, fx, texture, color, seed);
      };
      const fxByTarget = new Map(Object.keys(patterns).map((id) => [id, effectsFor(theme, id)]));
      for (const [id, pattern] of Object.entries(patterns)) {
        const fx = fxByTarget.get(id)!;
        if (
          fx.effect === "electric-text" &&
          effectVisible(fx) &&
          pattern.update(reduced ? 0 : seconds * fx.motion, fx.density, fx.boltLength)
        )
          textures[id].needsUpdate = true;
      }
      for (const item of graphEffectItems(source)) {
        const fx = fxByTarget.get(item.target);
        if (!fx || fx.effect !== "electric-text" || !effectVisible(fx)) continue;
        apply(item.object, fx, textures[item.target], item.color, effectSeed(item.id));
      }
    },
    dispose() {
      for (const state of [...resources]) state.dispose();
      for (const texture of Object.values(textures)) texture.dispose();
    },
  };
}
