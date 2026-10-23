import { ACTIONS, actionScope, shortcutBinding, preferredFeatureKey } from "../workspaceActions.ts";
/** Shift is reserved for configuration, ahead of executable shortcut matching. */
export function configurationTarget(bindings: Record<string, string>, chord: string, available: (id: string) => boolean, pointerFallback: Record<string, string> = {}): string | null {
  const parts = chord.split("+"); if (!parts.includes("Shift")) return null;
  const base = parts.filter(part => part !== "Shift").join("+"); if (!base) return null;
  const matches = [...ACTIONS.map(action => action.id as string), ...Object.keys(bindings).filter(id => id.startsWith("button:"))]
    .filter(id => shortcutBinding(id, bindings) === base);
  return preferredFeatureKey(bindings, base, available) ?? matches.find(id => actionScope(id) !== "global" && available(id)) ?? matches.find(id => actionScope(id) === "global") ?? pointerFallback[base] ?? null;
}
export const ACTION_CONFIGURATION_EVENT = "omnium:configure-action";
export function openActionConfiguration(id: string, position?: { x: number; y: number }) {
  window.dispatchEvent(new CustomEvent(ACTION_CONFIGURATION_EVENT, { detail: { id, position } }));
}
