import { normalizeSettings, type WorkspaceSettings } from "./workspaceActions.ts";
import { parseCustomFonts, type CustomFont } from "./fonts.ts";
export type ThemeTemplate = { format: "omnium-theme"; version: 1; name: string; appearance: WorkspaceSettings["appearance"]; fonts?: CustomFont[] };
export const THEME_PRESETS_KEY = "omnium.theme.presets.v1";
export function themeTemplate(name: string, appearance: WorkspaceSettings["appearance"], fonts?: CustomFont[]): ThemeTemplate {
  return { format: "omnium-theme", version: 1, name: name.trim().slice(0, 80) || "My theme", appearance: normalizeSettings({ appearance }).appearance, ...(fonts?.length ? { fonts: parseCustomFonts(fonts) } : {}) };
}
export function parseThemeTemplate(input: unknown): ThemeTemplate {
  if (!input || typeof input !== "object") throw new Error("Expected an Omnium theme template.");
  const value = input as Partial<ThemeTemplate>;
  if (value.format !== "omnium-theme" || value.version !== 1 || typeof value.name !== "string" || !value.name.trim() || !value.appearance || typeof value.appearance !== "object" || Array.isArray(value.appearance)) throw new Error("Expected an Omnium theme template version 1 with a name and appearance settings.");
  return themeTemplate(value.name, value.appearance, parseCustomFonts(value.fonts));
}
export function loadThemePresets(): ThemeTemplate[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(THEME_PRESETS_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.slice(0, 50).flatMap(item => { try { return [parseThemeTemplate(item)]; } catch { return []; } });
  } catch { return []; }
}
