/** Presentation only: font choices never change canonical text or concept identities. */
export const FONT_OPTIONS = [
  { id: "system", label: "System (default)", family: "system-ui, sans-serif" },
  { id: "sans", label: "Sans serif", family: "Arial, Helvetica, sans-serif" },
  { id: "serif", label: "Serif", family: "Georgia, 'Times New Roman', serif" },
  { id: "mono", label: "Monospace", family: "ui-monospace, SFMono-Regular, Consolas, monospace" },
  { id: "electric", label: "Rubik Glitch — electric", family: "'Rubik Glitch', system-ui, sans-serif" },
] as const;
export type CustomFontId = `custom:${string}`;
export type FontId = typeof FONT_OPTIONS[number]["id"] | CustomFontId;
export const isCustomFont = (value: unknown): value is CustomFontId => typeof value === "string" && /^custom:[0-9a-f]{64}$/.test(value);
export const normalizeFont = (value: unknown): FontId => isCustomFont(value) ? value : FONT_OPTIONS.find(font => font.id === value)?.id ?? "system";
export const customFontFamily = (id: CustomFontId) => `OmniumCustom_${id.slice(7)}`;
export const fontFamily = (value: unknown): string => isCustomFont(value) ? `'${customFontFamily(value)}', system-ui, sans-serif` : FONT_OPTIONS.find(font => font.id === value)?.family ?? FONT_OPTIONS[0].family;
export const canvasFont = (value: unknown, size = 36) => `${value === "electric" || isCustomFont(value) ? 400 : 500} ${size}px ${fontFamily(value)}`;

export type CustomFont = { id: CustomFontId; name: string; dataUrl: string };
export const MAX_FONT_BYTES = 10 * 1024 * 1024;
export const MAX_FONT_TEMPLATE_BYTES = 15 * 1024 * 1024;
export function parseCustomFonts(value: unknown): CustomFont[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 30) throw new Error("A font template may embed up to 30 referenced fonts.");
  const seen=new Set<string>();let total=0;
  return value.map(item => {
    if (!item || !isCustomFont(item.id) || typeof item.name !== "string" || !item.name.trim() || item.name.length > 120 || typeof item.dataUrl !== "string" || item.dataUrl.length > MAX_FONT_BYTES * 4 / 3 + 100 || !/^data:font\/(woff2?|ttf|otf);base64,[A-Za-z0-9+/]+={0,2}$/.test(item.dataUrl)) throw new Error("Invalid embedded font. Use WOFF2, WOFF, TTF or OTF, up to 10 MB.");
    if(seen.has(item.id))throw new Error('Duplicate embedded font ID.');seen.add(item.id);total+=item.dataUrl.length;
    if(total>MAX_FONT_TEMPLATE_BYTES-100_000)throw new Error('Embedded fonts exceed the 15 MB template limit.');
    return { id: item.id, name: item.name.trim(), dataUrl: item.dataUrl };
  });
}
