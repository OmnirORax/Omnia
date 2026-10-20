import { defaultSettings, normalizeSettings } from "../workspaceActions.ts";
import { sameAppearance, type Appearance } from "./session.ts";
export const CHECKPOINTS_KEY = "omnium.appearance.checkpoints.v1";
export const CHECKPOINT_LIMIT = 10;
export type Checkpoint = { id: string; name: string; createdAt: string; appearance: Appearance };
export function parseCheckpoints(value: unknown): Checkpoint[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value
    .flatMap((item) => {
      if (
        !item ||
        typeof item.id !== "string" ||
        !item.id ||
        ids.has(item.id) ||
        typeof item.name !== "string" ||
        !Number.isFinite(Date.parse(item.createdAt)) ||
        !item.appearance ||
        typeof item.appearance !== "object" ||
        Array.isArray(item.appearance)
      )
        return [];
      ids.add(item.id);
      return [
        {
          id: item.id,
          name: item.name.slice(0, 80),
          createdAt: item.createdAt,
          appearance: normalizeSettings({ appearance: item.appearance }).appearance,
        },
      ];
    })
    .slice(-CHECKPOINT_LIMIT);
}
export function loadCheckpoints(): Checkpoint[] {
  try {
    return parseCheckpoints(JSON.parse(localStorage.getItem(CHECKPOINTS_KEY) ?? "[]"));
  } catch {
    return [];
  }
}
export function appendCheckpoint(
  checkpoints: Checkpoint[],
  appearance: Appearance,
  name = "Applied appearance",
  force = false,
): Checkpoint[] {
  const clean = normalizeSettings({ appearance }).appearance;
  if (!force && checkpoints.length && sameAppearance(checkpoints.at(-1)!.appearance, clean))
    return checkpoints;
  return [
    ...checkpoints,
    {
      id: crypto.randomUUID(),
      name: name.trim().slice(0, 80) || "Appearance checkpoint",
      createdAt: new Date().toISOString(),
      appearance: clean,
    },
  ].slice(-CHECKPOINT_LIMIT);
}
export function safeAppearance(): Appearance {
  const appearance = defaultSettings().appearance;
  return {
    ...appearance,
    atmosphere: false,
    effect: "off",
    motion: 0,
    glow: 0,
    textGlow: 0,
    controlGlow: 0,
    windowOpacity: 1,
    opacity: 1,
    blur: 0,
    nodes: { opacity: 1, glow: 0 },
    binders: { opacity: 1, glow: 0 },
  };
}
