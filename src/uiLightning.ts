import { imageContours, lightningBolts, type Contour } from "./lightning";
import type { SparkleStyle } from "./graph/effects";
type Snapshot = { signature: string; paths: Contour[] };
const cache = new WeakMap<HTMLElement, Snapshot>();
/** Rasterize only displayed lettering and icons, omitting panel/button backgrounds. */
function snapshot(element: HTMLElement, rect: DOMRect, clip: { x: number; y: number; width: number; height: number }): Contour[] {
  const inputs = [...element.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input,textarea,select")];
  if (element.matches("input,textarea,select")) inputs.unshift(element as HTMLInputElement);
  const images = [...element.querySelectorAll<HTMLImageElement>("img")];
  const signature = [rect.width, rect.height, clip.x - rect.x, clip.y - rect.y, clip.width, clip.height, element.textContent, getComputedStyle(element).font, ...inputs.map(input => `${input.value}:${input.scrollLeft}:${input.scrollTop}`), ...images.map(img => `${img.currentSrc}:${img.complete}:${img.naturalWidth}`), ...[element, ...element.querySelectorAll(".floating-body,.ui-panel-body")].map(el => `${el.scrollTop}:${el.scrollLeft}`)].join("|");
  const previous = cache.get(element); if (previous?.signature === signature) return previous.paths;
  const canvas = document.createElement("canvas"), scale = Math.min(1.5, 512 / Math.max(clip.width, clip.height));
  canvas.width = Math.max(1, Math.ceil(clip.width * scale)); canvas.height = Math.max(1, Math.ceil(clip.height * scale));
  const context = canvas.getContext("2d"); if (!context) return [];
  context.scale(scale, scale); context.translate(-clip.x, -clip.y); context.fillStyle = "white";
  const visible = (el: Element) => !!el.getClientRects().length && !el.closest("[hidden],.ui-drag-source") && getComputedStyle(el).visibility !== "hidden";
  const overlaps = (r: DOMRect) => r.right >= clip.x && r.left <= clip.x + clip.width && r.bottom >= clip.y && r.top <= clip.y + clip.height;
  const text = (value: string, r: DOMRect, style: CSSStyleDeclaration) => {
    if (!overlaps(r)) return;
    context.font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    context.textBaseline = "alphabetic";
    const metric = context.measureText("Mg"), ascent = metric.fontBoundingBoxAscent || parseFloat(style.fontSize) * 0.8, descent = metric.fontBoundingBoxDescent || parseFloat(style.fontSize) * 0.2;
    context.fillText(value, r.left, r.top + (r.height - ascent - descent) / 2 + ascent);
  };
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node: Node | null, characters = 0;
  while ((node = walker.nextNode()) && characters < 900) {
    if (!node.textContent?.trim() || !node.parentElement || !visible(node.parentElement) || node.parentElement.closest("script,style,textarea,select")) continue;
    const range = document.createRange(); range.selectNodeContents(node);
    const rects = [...range.getClientRects()], value = node.textContent, style = getComputedStyle(node.parentElement);
    if (!rects.some(overlaps)) continue;
    if (rects.length === 1) { text(value.replace(/\s+/g, " "), rects[0], style); characters += value.length; }
    else for (let i = 0; i < value.length && characters < 900; i++, characters++) {
      if (/\s/.test(value[i])) continue;
      range.setStart(node, i); range.setEnd(node, i + 1); const r = range.getBoundingClientRect(); text(value[i], r, style);
    }
  }
  for (const input of inputs.slice(0, 30)) {
    if (!visible(input) || input instanceof HTMLInputElement && ["range", "checkbox", "color", "file", "hidden", "password"].includes(input.type)) continue;
    const r = input.getBoundingClientRect(), style = getComputedStyle(input); if (!overlaps(r)) continue;
    const value = input instanceof HTMLSelectElement ? input.selectedOptions[0]?.text ?? "" : input.value || (input as HTMLInputElement).placeholder || "";
    const left = r.x + parseFloat(style.paddingLeft || "0"), lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    context.save(); context.beginPath(); context.rect(left, r.top + 2, Math.max(0, r.width - parseFloat(style.paddingLeft || "0") - parseFloat(style.paddingRight || "0")), r.height - 4); context.clip();
    for (const [i, line] of value.split("\n").slice(0, 20).entries()) text(line, new DOMRect(left - input.scrollLeft, input instanceof HTMLTextAreaElement ? r.top + parseFloat(style.paddingTop || "0") + i * lineHeight - input.scrollTop : r.top, r.width, input instanceof HTMLTextAreaElement ? lineHeight : r.height), style);
    context.restore();
  }
  for (const image of images.slice(0, 20)) {
    if (!visible(image) || !image.complete || !image.naturalWidth || !overlaps(image.getBoundingClientRect())) continue;
    const url = image.currentSrc || image.src;
    if (!url.startsWith("data:") && new URL(url, location.href).origin !== location.origin) continue;
    const r = image.getBoundingClientRect(), fit = getComputedStyle(image).objectFit;
    const factor = Math.min(r.width / image.naturalWidth, r.height / image.naturalHeight);
    const width = fit === "contain" ? image.naturalWidth * factor : r.width, height = fit === "contain" ? image.naturalHeight * factor : r.height;
    try { context.drawImage(image, r.left + (r.width - width) / 2, r.top + (r.height - height) / 2, width, height); } catch { /* A loading icon retries on its load event. */ }
  }
  const paths = imageContours(canvas); cache.set(element, { signature, paths }); return paths;
}
/** Draws narrow colored halos and white-hot cores, without capturing pointer input. */
export function drawUILightning(context: CanvasRenderingContext2D, element: HTMLElement, rect: DOMRect, fx: SparkleStyle, seconds: number, seed: number, opacity: number, animated: boolean, budget: number): number {
  const clip = { x: Math.max(0, rect.x), y: Math.max(0, rect.y), width: Math.min(innerWidth, rect.right) - Math.max(0, rect.x), height: Math.min(innerHeight, rect.bottom) - Math.max(0, rect.y) };
  if (clip.width <= 0 || clip.height <= 0 || budget <= 0) return 0;
  const paths = snapshot(element, rect, clip), bolts = lightningBolts(paths, seed, seconds, fx.density, fx.boltLength, animated);
  let segments = 0;
  context.save(); context.shadowColor = typeof context.strokeStyle === "string" ? context.strokeStyle : fx.color ?? "#60ddec"; context.lineJoin = "round"; context.lineCap = "round";
  for (const bolt of bolts) {
    if (segments + bolt.points.length > budget) break;
    context.beginPath(); bolt.points.forEach((p, i) => { const x = clip.x + (p.x + 0.5) * clip.width, y = clip.y + (0.5 - p.y) * clip.height; if (i) context.lineTo(x, y); else context.moveTo(x, y); });
    context.shadowBlur = 5; context.globalAlpha = opacity * fx.intensity * bolt.strength * 0.25; context.lineWidth = 3; context.stroke();
    context.shadowBlur = 0; context.globalAlpha = opacity * fx.intensity * bolt.strength; context.lineWidth = 0.85; context.stroke();
    if (bolt.strength > 0.5) { context.strokeStyle = "#ffffff"; context.globalAlpha *= 0.65; context.lineWidth = 0.4; context.stroke(); context.strokeStyle = context.shadowColor; }
    segments += bolt.points.length;
  }
  context.restore(); return segments;
}
