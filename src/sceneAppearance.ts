import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { defaultSettings, type WorkspaceSettings } from "./workspaceActions";

type Appearance = WorkspaceSettings["appearance"];
/** Effects are decorative: no picking, saved placements or canonical knowledge. */
export function createSceneAppearance(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
  let composer: EffectComposer | null = null, bloom: UnrealBloomPass | null = null, output: OutputPass | null = null;
  let appearance: Appearance = { ...defaultSettings().appearance, theme: "classic" };
  let width = 1, height = 1, failed = false, phase = 0, previousTime = 0;
  let seed = 173;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const positions = new Float32Array(720 * 3);
  for (let i = 0; i < 720; i++) {
    const angle = random() * Math.PI * 2, z = random() * 2 - 1, radius = 12 + random() * 115;
    positions.set([Math.cos(angle) * Math.sqrt(1 - z * z) * radius, z * radius, Math.sin(angle) * Math.sqrt(1 - z * z) * radius], i * 3);
  }
  const textures = new Map<string, THREE.CanvasTexture>();
  const textureFor = (effect: Appearance["effect"]) => {
    if (textures.has(effect)) return textures.get(effect)!;
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d")!;
    const glow = context.createRadialGradient(32, 32, 0, 32, 32, 30);
    glow.addColorStop(0, "#ffffff"); glow.addColorStop(0.16, "#ffffffd0"); glow.addColorStop(1, "#ffffff00");
    context.fillStyle = glow; context.fillRect(0, 0, 64, 64);
    if (effect === "stars") {
      context.strokeStyle = "#ffffffaa"; context.lineWidth = 2;
      context.beginPath(); context.moveTo(32, 8); context.lineTo(32, 56); context.moveTo(8, 32); context.lineTo(56, 32); context.stroke();
    } else if (effect === "sparks") {
      context.clearRect(0, 0, 64, 64);
      const streak = context.createLinearGradient(0, 4, 0, 60);
      streak.addColorStop(0, "#ffffff00"); streak.addColorStop(0.75, "#ffffffaa"); streak.addColorStop(1, "#ffffff00");
      context.fillStyle = streak; context.fillRect(29, 4, 6, 56);
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.set(effect, texture); return texture;
  };
  const particles = new THREE.Points(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(positions, 3)),
    new THREE.PointsMaterial({ color: 0x60ddec, size: 3, sizeAttenuation: false, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  particles.visible = false; particles.name = "Decorative atmosphere"; scene.add(particles);
  const disposeBloom = () => { bloom?.dispose(); output?.dispose(); composer?.dispose(); bloom = null; output = null; composer = null; };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let timer: ReturnType<typeof setTimeout> | undefined, redraw: (() => void) | undefined;
  const moving = () => appearance.theme === "neon" && appearance.atmosphere && appearance.effect !== "off" && appearance.motion > 0 && appearance.effectIntensity > 0 && appearance.density > 0 && !reducedMotion.matches;
  const schedule = () => {
    if (timer !== undefined) clearTimeout(timer); timer = undefined;
    if (!redraw || document.hidden || !moving()) return;
    timer = setTimeout(() => { timer = undefined; redraw?.(); schedule(); }, 1000 / 30);
  };
  const resume = () => { previousTime = 0; schedule(); redraw?.(); };
  document.addEventListener("visibilitychange", resume); reducedMotion.addEventListener("change", resume);
  return {
    start(callback: () => void) { redraw = callback; schedule(); },
    configure(value: Appearance) {
      appearance = value;
      const neon = value.theme === "neon";
      scene.background = new THREE.Color(neon ? value.background : 0x101927);
      particles.visible = neon && value.atmosphere && value.effect !== "off";
      particles.geometry.setDrawRange(0, Math.round(720 * value.density));
      particles.material.color.set(value.accent);
      particles.material.map = textureFor(value.effect);
      particles.material.size = value.effect === "sparks" ? 11 : value.effect === "dust" ? 4 : 3;
      particles.material.opacity = value.effectIntensity; particles.material.needsUpdate = true;
      if (!neon || value.glow === 0) disposeBloom();
      if (bloom) bloom.strength = value.glow;
      previousTime = 0; schedule();
    },
    resize(w: number, h: number) { width = w; height = h; composer?.setSize(w, h); },
    render() {
      const now = performance.now();
      if (moving()) phase += Math.min(0.1, previousTime ? (now - previousTime) / 1000 : 0) * appearance.motion;
      previousTime = now;
      particles.rotation.y = phase * 0.025;
      particles.rotation.z = appearance.effect === "sparks" ? phase * 0.01 : 0;
      particles.position.y = appearance.effect === "sparks" ? Math.sin(phase * 0.08) * 3 : 0;
      particles.material.opacity = appearance.effectIntensity * (moving() ? 0.9 + 0.1 * Math.sin(phase * 1.3) : 1);
      if (appearance.theme === "neon" && appearance.glow > 0 && !failed) {
        try {
          if (!composer) {
            const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: Math.min(4, renderer.capabilities.maxSamples) });
            composer = new EffectComposer(renderer, target);
            composer.addPass(new RenderPass(scene, camera));
            bloom = new UnrealBloomPass(new THREE.Vector2(width, height), appearance.glow, 0.3, 0.72);
            composer.addPass(bloom); output = new OutputPass(); composer.addPass(output);
            composer.setSize(width, height);
          }
          composer.render(); return;
        } catch {
          failed = true; disposeBloom(); renderer.setRenderTarget(null);
        }
      }
      renderer.render(scene, camera);
    },
    dispose() {
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume); reducedMotion.removeEventListener("change", resume);
      redraw = undefined; disposeBloom(); scene.remove(particles); particles.geometry.dispose(); particles.material.dispose();
      for (const texture of textures.values()) texture.dispose();
    },
  };
}
