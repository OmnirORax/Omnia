import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { WorkspaceSettings } from "./workspaceActions";

/** Presentation only. Atmosphere is not graph knowledge and never participates in picking. */
export function createSceneAppearance(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
  let composer: EffectComposer | null = null, bloom: UnrealBloomPass | null = null, output: OutputPass | null = null;
  let appearance: WorkspaceSettings["appearance"] = { theme: "classic", glow: 0, atmosphere: false };
  let width = 1, height = 1, failed = false;
  let seed = 173;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const positions = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i++) {
    const angle = random() * Math.PI * 2, z = random() * 2 - 1, radius = 45 + random() * 135;
    positions.set([Math.cos(angle) * Math.sqrt(1 - z * z) * radius, z * radius, Math.sin(angle) * Math.sqrt(1 - z * z) * radius], i * 3);
  }
  const dust = new THREE.Points(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(positions, 3)),
    new THREE.PointsMaterial({ color: 0x5dcee3, size: 0.13, transparent: true, opacity: 0.24, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  dust.visible = false; dust.name = "Decorative atmosphere"; scene.add(dust);
  const disposeBloom = () => { bloom?.dispose(); output?.dispose(); composer?.dispose(); bloom = null; output = null; composer = null; };
  return {
    configure(value: WorkspaceSettings["appearance"]) {
      appearance = value;
      const neon = value.theme === "neon";
      scene.background = new THREE.Color(neon ? 0x030c15 : 0x101927);
      dust.visible = neon && value.atmosphere;
      if (!neon || value.glow === 0) disposeBloom();
      if (bloom) bloom.strength = value.glow;
    },
    resize(w: number, h: number) { width = w; height = h; composer?.setSize(w, h); },
    render() {
      if (appearance.theme === "neon" && appearance.glow > 0 && !failed) {
        try {
          if (!composer) {
            composer = new EffectComposer(renderer);
            composer.addPass(new RenderPass(scene, camera));
            bloom = new UnrealBloomPass(new THREE.Vector2(width, height), appearance.glow, 0.35, 0.45);
            composer.addPass(bloom); output = new OutputPass(); composer.addPass(output);
            composer.setSize(width, height);
          }
          composer.render(); return;
        } catch {
          // Keep charting available if a device cannot allocate post-processing targets.
          failed = true; disposeBloom(); renderer.setRenderTarget(null);
        }
      }
      renderer.render(scene, camera);
    },
    dispose() { disposeBloom(); scene.remove(dust); dust.geometry.dispose(); dust.material.dispose(); },
  };
}
