import { canvasFont, customFontFamily, isCustomFont, MAX_FONT_BYTES, parseCustomFonts, type CustomFont, type FontId } from "./fonts";

/** Browser font files are stored once, separately from lightweight settings/history. */
async function store<T>(mode: IDBTransactionMode, request: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open("omnium-font-library", 1);
    open.onupgradeneeded = () => { open.result.createObjectStore("fonts", { keyPath: "id" }); };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction("fonts", mode), operation = request(transaction.objectStore("fonts"));
      transaction.oncomplete = () => resolve(operation.result);
      transaction.onerror = transaction.onabort = () => reject(transaction.error ?? operation.error ?? new Error("Font storage failed."));
    });
  } finally { db.close(); }
}
export const listCustomFonts = () => store<CustomFont[]>("readonly", store => store.getAll()).then(fonts => fonts.sort((a, b) => a.name.localeCompare(b.name)));
const getFont = (id: string) => store<CustomFont | undefined>("readonly", store => store.get(id));
const faces = new Map<string, Promise<FontFace | null>>();
const decode = (font: CustomFont) => Uint8Array.from(atob(font.dataUrl.split(",")[1]), character => character.charCodeAt(0));
async function contentId(bytes: Uint8Array<ArrayBuffer>): Promise<CustomFont["id"]> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return `custom:${Array.from(digest, value => value.toString(16).padStart(2, "0")).join("")}`;
}
function fontFormat(bytes: Uint8Array): string {
  const header = Array.from(bytes.subarray(0, 4), byte => String.fromCharCode(byte)).join("");
  const format = ({ wOFF: "woff", wOF2: "woff2", OTTO: "otf", true: "ttf", "\u0000\u0001\u0000\u0000": "ttf" } as Record<string, string>)[header];
  if (!format) throw new Error("This is not a WOFF2, WOFF, TTF or OTF font file.");
  return format;
}
async function register(font: CustomFont): Promise<FontFace> {
  const face = new FontFace(customFontFamily(font.id), decode(font));
  document.fonts.add(face);
  try { return await face.load(); }
  catch { document.fonts.delete(face); throw new Error(`“${font.name}” could not be decoded as a browser font.`); }
}
export function loadFont(id: FontId): Promise<FontFace | null> {
  if (!isCustomFont(id)) return document.fonts.load(canvasFont(id)).then(() => null);
  if (!faces.has(id)) {
    const pending = getFont(id).then(font => {
      if (!font) throw new Error("This custom font is missing from this browser. Import its font file or a theme containing it.");
      return register(font);
    }).catch(error => { faces.delete(id); throw error; });
    faces.set(id, pending);
  }
  return faces.get(id)!;
}
export async function importCustomFonts(input: unknown): Promise<void> {
  for (const font of parseCustomFonts(input)) {
    const bytes = decode(font);
    fontFormat(bytes);
    if (await contentId(bytes) !== font.id) throw new Error("The embedded font's ID does not match its file contents.");
    if (await getFont(font.id)) { await loadFont(font.id); continue; }
    const face = await register(font);
    try { await store("readwrite", store => store.put(font)); }
    catch { document.fonts.delete(face); throw new Error("The font could not be saved in this browser. Storage may be full or unavailable."); }
    faces.set(font.id, Promise.resolve(face));
  }
}
export async function importFontFile(file: File): Promise<CustomFont> {
  if (!/\.(woff2?|ttf|otf)$/i.test(file.name) || file.size > MAX_FONT_BYTES || !file.size) throw new Error("Choose a WOFF2, WOFF, TTF or OTF file, up to 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer()), format = fontFormat(bytes), id = await contentId(bytes);
  const existing = await getFont(id); if (existing) { await loadFont(id); return existing; }
  let binary = ""; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const font: CustomFont = { id, name: file.name.replace(/\.(woff2?|ttf|otf)$/i, "").trim().slice(0, 120) || "Imported font", dataUrl: `data:font/${format};base64,${btoa(binary)}` };
  await importCustomFonts([font]); return font;
}
export async function embeddedFont(id: FontId): Promise<CustomFont[]> {
  if (!isCustomFont(id)) return [];
  const font = await getFont(id);
  if (!font) throw new Error("Import the missing custom font before exporting this template.");
  return [font];
}
