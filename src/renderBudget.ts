/** Conservative shared rendering limits. Input/selection semantics stay unchanged;
 * decoration quality is bounded rather than scaling freely with viewport/DPR. */
export const RENDER_BUDGET = {
  omnicVectorPrimitives: 128, omnicTextPrimitives: 32_000,
  omnicSceneSources: 32, omnicTextureEdge: 256, omnicAnimatedRoles: 256, omnicFps: 12, omnicDraftBatchMs: 4,
  wallpaperPixels: 8_294_400, maxWallpaperDpr: 2,
  sceneSamples: 4, scenePixels: 1_500_000, overlayPixels: 1_000_000, maxSceneDpr: 1.25,
  bloomEdge: 512, uiGlow: .8, uiBlur: 8, effectFps: 20, uiEffectHosts: 24, particles: 500, lightningSegments: 800, electricPixels: 400_000,
} as const;
export const budgetPixelRatio = (width: number, height: number, dpr: number, pixels: number, maxDpr: number) =>
  Math.min(dpr, maxDpr, Math.sqrt(pixels / Math.max(1, width * height)));
/** Full-detail wallpaper output; graph targets retain scenePixels independently. */
export const sceneOutputPixelRatio=(width:number,height:number,dpr:number,wallpaper:boolean)=>
  budgetPixelRatio(width,height,dpr,wallpaper?RENDER_BUDGET.wallpaperPixels:RENDER_BUDGET.scenePixels,wallpaper?RENDER_BUDGET.maxWallpaperDpr:RENDER_BUDGET.maxSceneDpr);
export function bloomSize(width: number, height: number) {
  const scale = Math.min(1, RENDER_BUDGET.bloomEdge / Math.max(1, width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Decoration yields to interaction after sustained expensive frames. A quiet
 * period is not a slow frame; callers reset timing when hidden/static. Quality
 * only decreases during a session, avoiding repeated stalls/quality oscillation. */
export function createDecorationAllowance(initial: number) {
  let sources = initial, previous = 0, strikes = 0;
  return {
    get sources() { return sources; },
    resetTiming() { previous = 0; strikes = 0; },
    sample(start: number, cost: number) {
      const late = previous > 0 && start - previous > 160;
      previous = start;
      strikes = cost > 12 || late ? strikes + 1 : 0;
      if (strikes < 3 || sources === 0) return false;
      sources = sources > 1 ? Math.max(1, Math.floor(sources / 2)) : 0;
      strikes = 0; return true;
    },
  };
}
let uiEffectSources: number = RENDER_BUDGET.uiEffectHosts;
const listeners = new Set<() => void>();
export const uiEffectBudgetSnapshot = () => uiEffectSources;
export const subscribeUIEffectBudget = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function publishUIEffectBudget(sources: number) {
  if (sources === uiEffectSources) return;
  uiEffectSources = sources; for (const listener of listeners) listener();
}

/** Coverage samples stay bounded by both the shared budget and device support. */
export const sceneSampleCount=(maxSamples:number)=>Math.max(0,Math.min(RENDER_BUDGET.sceneSamples,Math.floor(Number.isFinite(maxSamples)?maxSamples:0)));
