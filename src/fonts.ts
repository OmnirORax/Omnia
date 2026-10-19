/** Presentation only: font choices never change canonical text or concept identities. */
export const FONT_OPTIONS = [
  { id: "system", label: "System (default)", family: "system-ui, sans-serif" },
  { id: "sans", label: "Sans serif", family: "Arial, Helvetica, sans-serif" },
  { id: "serif", label: "Serif", family: "Georgia, 'Times New Roman', serif" },
  { id: "mono", label: "Monospace", family: "ui-monospace, SFMono-Regular, Consolas, monospace" },
  { id: "electric", label: "Rubik Glitch — electric", family: "'Rubik Glitch', system-ui, sans-serif" },
] as const;
export type FontId = typeof FONT_OPTIONS[number]["id"];
export const normalizeFont = (value: unknown): FontId => FONT_OPTIONS.find(font => font.id === value)?.id ?? "system";
export const fontFamily = (value: unknown): string => FONT_OPTIONS.find(font => font.id === value)?.family ?? FONT_OPTIONS[0].family;
export const canvasFont = (value: unknown, size = 36) => `${value === "electric" ? 400 : 500} ${size}px ${fontFamily(value)}`;
