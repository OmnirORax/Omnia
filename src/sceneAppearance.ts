import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SceneGlow } from "./sceneGlow";
import { createSceneLightning } from "./sceneLightning";
import { createSceneElectricText } from "./sceneElectricText";
import { createStructuralSparkles } from "./structuralSparkles";
import { effectVisible, resolveTargetSparkles } from "./graph/effects";
import type { TextScene } from "./textScene";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { defaultSettings, type WorkspaceSettings } from "./workspaceActions";

type Appearance = WorkspaceSettings["appearance"];
/** Effects are decorative: no picking, saved placements or canonical knowledge. */
export function createSceneAppearance(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
  let composer: EffectComposer | null = null, bloom: SceneGlow | null = null, output: OutputPass | null = null;
  let appearance: Appearance = { ...defaultSettings().appearance, theme: "classic" };
  let width = 1, height = 1, failed = false, phase = 0, previousTime = 0;
  const textures = new Map<string, THREE.CanvasTexture>();
  const textureFor = (effect: Appearance["effect"]) => {
    if (textures.has(effect)) return textures.get(effect)!;
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d")!;
    const glow = context.createRadialGradient(32, 32, 0, 32, 32, 30);
    glow.addColorStop(0, "#ffffff"); glow.addColorStop(0.16, "#ffffffd0"); glow.addColorStop(1, "#ffffff00");
    context.fillStyle = glow; context.fillRect(0, 0, 64, 64);
    if (effect === "stars" || effect === "falling-stars") {
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
  const structural = createStructuralSparkles(scene), lightning = createSceneLightning(scene), electricText = createSceneElectricText();
  let sources: () => TextScene | null = () => null;
  const disposeBloom = () => { bloom?.dispose(); output?.dispose(); composer?.dispose(); bloom = null; output = null; composer = null; };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let timer: ReturnType<typeof setTimeout> | undefined, redraw: (() => void) | undefined;
  const moving = () => {
    if (appearance.opacity === 0 || reducedMotion.matches) return false;
    const source = sources(), fx = [resolveTargetSparkles(appearance, "nodes"), resolveTargetSparkles(appearance, "binders"), resolveTargetSparkles(appearance, "background")];
    if (appearance.motion > 0 && [...(source?.nodes.values() ?? [])].some(node => node.selected)) return true;
    return appearance.theme === "neon" && fx.some((value, index) => effectVisible(value) && value.motion > 0 && (index === 0 ? source?.nodes.size : index === 1 ? source?.connectors.length : true));
  };
  const schedule = () => {
    if (timer !== undefined) clearTimeout(timer); timer = undefined;
    if (!redraw || document.hidden || !moving()) return;
    timer = setTimeout(() => { timer = undefined; redraw?.(); schedule(); }, 1000 / 30);
  };
  const resume = () => { previousTime = 0; schedule(); redraw?.(); };
  document.addEventListener("visibilitychange", resume); reducedMotion.addEventListener("change", resume);
  return {
    setSources(callback: () => TextScene | null) { sources = callback; },
    start(callback: () => void) { redraw = callback; schedule(); },
    configure(value: Appearance) {
      appearance = value;
      const neon = value.theme === "neon";
      scene.background = new THREE.Color(neon ? value.background : 0x101927);
      if (!neon || value.glow === 0) disposeBloom();
      bloom?.configure(value.glow, value.glowSpread);
      previousTime = 0; schedule();
    },
    resize(w: number, h: number) { width = w; height = h; composer?.setSize(w, h); },
    render() {
      const now = performance.now();
      if (moving()) phase += Math.min(0.1, previousTime ? (now - previousTime) / 1000 : 0);
      previousTime = now;
      sources()?.animateSelection(camera, phase, !reducedMotion.matches && appearance.motion > 0);
      structural.update(appearance, sources(), reducedMotion.matches ? 0 : phase, camera, textureFor);
      lightning.update(appearance, sources(), phase, camera, width, height, reducedMotion.matches);
      electricText.update(appearance, sources(), phase, camera, reducedMotion.matches);
      if (timer === undefined) schedule();
      if (appearance.theme === "neon" && appearance.glow > 0 && !failed) {
        try {
          if (!composer) {
            const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: Math.min(4, renderer.capabilities.maxSamples) });
            composer = new EffectComposer(renderer, target);
            composer.addPass(new RenderPass(scene, camera));
            bloom = new SceneGlow(scene, camera, renderer.capabilities.maxSamples);
            bloom.configure(appearance.glow, appearance.glowSpread);
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
      redraw = undefined; disposeBloom(); structural.dispose(); lightning.dispose(); electricText.dispose();
      for (const texture of textures.values()) texture.dispose();
    },
  };
}
