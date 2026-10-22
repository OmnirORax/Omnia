import * as THREE from "three";
import type { TextScene } from "../textScene";
import { graphEffectItems, GRAPH_EFFECT_TARGETS } from "./graphEffects";

/** Transient shader paint isolates glyphs, backgrounds and contours on shared label textures. */
export function createGraphHierarchyPulse() {
  const states = new Map<THREE.Material, {
    strength: THREE.Vector4; dispose: () => void;
  }>();
  const configure = (object: THREE.Mesh, material: THREE.Material, rounded: boolean) => {
    const existing = states.get(material); if (existing) return existing;
    const previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey;
    const factory = object.userData.lightningMask as (() => HTMLCanvasElement) | undefined;
    const glyph = factory ? new THREE.CanvasTexture(factory()) : null;
    const image = glyph?.image as { width: number; height: number } | undefined;
    const strength = new THREE.Vector4();
    const uniforms = {
      omniumHoverStrength: { value: strength },
      omniumHoverGlyph: { value: glyph },
      omniumHoverSize: { value: new THREE.Vector2(image?.width ?? 128, image?.height ?? 128) },
      omniumHoverRadius: { value: rounded ? 12 : 0 },
    };
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = `uniform vec4 omniumHoverStrength;
        uniform sampler2D omniumHoverGlyph;
        uniform vec2 omniumHoverSize;
        uniform float omniumHoverRadius;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <tonemapping_fragment>", `
        float hoverPaint = omniumHoverStrength.x;
        #ifdef USE_MAP
          float hoverGlyph = texture2D(omniumHoverGlyph, vMapUv).a;
          vec2 hoverEdge = abs((vMapUv - 0.5) * omniumHoverSize) - (omniumHoverSize * 0.5 - vec2(omniumHoverRadius + 1.0));
          float hoverDistance = length(max(hoverEdge, 0.0)) + min(max(hoverEdge.x, hoverEdge.y), 0.0) - omniumHoverRadius;
          float hoverContour = 1.0 - smoothstep(0.8, 2.8, abs(hoverDistance));
          hoverPaint = max(hoverPaint, omniumHoverStrength.y * hoverGlyph);
          hoverPaint = max(hoverPaint, omniumHoverStrength.z * (1.0 - hoverGlyph) * (1.0 - hoverContour));
          hoverPaint = max(hoverPaint, omniumHoverStrength.w * hoverContour);
        #endif
        gl_FragColor.rgb = mix(gl_FragColor.rgb, min(gl_FragColor.rgb * 1.5 + vec3(0.35), vec3(1.35)), hoverPaint);
        #include <tonemapping_fragment>`);
    };
    material.customProgramCacheKey = () => previousKey.call(material) + "|hierarchy-pulse-v1";
    material.needsUpdate = true;
    const dispose = () => {
      glyph?.dispose(); states.delete(material); material.removeEventListener("dispose", dispose);
      material.onBeforeCompile = previous; material.customProgramCacheKey = previousKey;
    };
    material.addEventListener("dispose", dispose);
    const state = { strength, dispose }; states.set(material, state); return state;
  };
  const clear = () => { for (const state of states.values()) state.strength.set(0, 0, 0, 0); };
  return {
    update(source: TextScene | null, targets: ReadonlyMap<string, boolean>, wave: number) {
      clear(); if (!source || !GRAPH_EFFECT_TARGETS.some(target => targets.has(target))) return;
      for (const item of graphEffectItems(source)) {
        const active = targets.get(item.target); if (active === undefined || !item.object.visible) continue;
        item.object.traverse(object => {
          if (!(object instanceof THREE.Mesh) || !object.visible) return;
          const plane = object.geometry.type === "PlaneGeometry" && !!object.userData.lightningMask;
          const channel = !plane ? 0 : item.kind === "glyph" ? 1 : item.kind === "surface" ? 2 : item.kind === "contour" ? 3 : 0;
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            const state = configure(object, material, item.target.includes("nodes"));
            state.strength.setComponent(channel, Math.max(state.strength.getComponent(channel), (0.1 + wave * .85) * (active ? 1 : .5)));
          }
        });
      }
    },
    clear,
    dispose() { for (const state of [...states.values()]) state.dispose(); },
  };
}
