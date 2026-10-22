/** Renderer adapters share one registration for hierarchy and selector feedback.
 * These transient paints never become appearance values or history entries. */
export type SceneSelectionPaint = { color: string; opacity: number };
export type HierarchyScenePulse = {
  pulse: (targets: ReadonlyMap<string, boolean>, strength: number) => void;
  clear: () => void;
  pick?: (target: string, element: Element, x: number, y: number) => boolean;
  paint?: (target: string, element: Element) => string | undefined;
  selection?: (targets: ReadonlyMap<string, SceneSelectionPaint>, strength: number) => void;
};
export const sceneSources = new Set<HierarchyScenePulse>();
let selection: ReadonlyMap<string, SceneSelectionPaint> = new Map(), strength = 0;
export function registerHierarchyScene(source: HierarchyScenePulse) {
  sceneSources.add(source);
  source.selection?.(selection, strength);
  return () => { source.selection?.(new Map(), 0); source.clear(); sceneSources.delete(source); };
}
export const scenePartAt = (target: string, element: Element, x: number, y: number) =>
  [...sceneSources].some(source => source.pick?.(target, element, x, y));
export const scenePartPaint = (target: string, element: Element) =>
  [...sceneSources].map(source => source.paint?.(target, element)).find(paint => paint !== undefined);
export function paintSceneSelection(targets: ReadonlyMap<string, SceneSelectionPaint>, value: number) {
  selection = targets; strength = value;
  for (const source of sceneSources) source.selection?.(targets, value);
}
