import { unavailableControl } from "./ui/controlAvailability.ts";
import { clipCanvas, type PaintClip } from "./ui/paintClip.ts";
import { alphaContours, lightningBolts, type Contour } from "./lightning.ts";
import type { SparkleStyle } from "./graph/effects";
import { createElectricInk } from "./electricInk.ts";
export type GlyphScope = {
  key: string;
  shape?: "surface" | "contour" | "glyphs";
  text?: (parent: HTMLElement) => boolean;
  node?: (node: Node) => boolean;
  input?: (input: HTMLElement) => boolean;
  icons?: boolean;
  clip?: (element: HTMLElement, contents?: boolean) => PaintClip;
};
const maskImages = new Map<string, HTMLImageElement>();
function cssMask(element: HTMLElement) {
  const url = getComputedStyle(element).maskImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
  if (!url || !url.startsWith("data:image/")) return;
  let image = maskImages.get(url);
  if (!image) {
    if (maskImages.size >= 64) maskImages.delete(maskImages.keys().next().value!);
    image = new Image();
    maskImages.set(url, image);
    image.onload = () => {
      clearUILightningContours();
      element.dispatchEvent(new Event("load"));
    };
    image.src = url;
  }
  return image;
}
type Snapshot = {
  empty?: boolean;
  inputValue?: string;
  readback: boolean;
  paint?: { tile: ElectricTile; revision: number };
  signature: string;
  paths?: Contour[];
  mask: HTMLCanvasElement;
  ink: HTMLCanvasElement;
};
let cache = new WeakMap<HTMLElement, Map<string, Snapshot>>();
// A measured job retains its scope between animation frames. Check this before
// any DOM queries/signature reads; local and inherited masks may share a host.
let scopes = new WeakMap<GlyphScope, Snapshot>();
export const clearUILightningContours = () => {
  cache = new WeakMap();
  scopes = new WeakMap();
};
/** Content/style edits invalidate affected hosts and their ancestors, not every
 * unrelated text mask. Rebuilt jobs receive new scopes after this notification. */
export function invalidateUILightningContours(elements: Iterable<Element>) {
  scopes = new WeakMap();
  const seen = new Set<Element>();
  for (const element of elements) for (let host: Element | null = element; host && !seen.has(host); host = host.parentElement) {
    seen.add(host); cache.delete(host as HTMLElement);
  }
}
/** Rasterize only displayed lettering and icons, omitting panel/button backgrounds. */
function snapshot(
  element: HTMLElement,
  rect: DOMRect,
  clip: { x: number; y: number; width: number; height: number },
  scope?: GlyphScope,
  readback = false,
): Snapshot | null {
  const inputValue = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement ? element.value : undefined;
  const cachedScope = scope && scopes.get(scope);
  // React can update a controlled field's value without a DOM mutation/event.
  // Reading its value is cheap and does not require measuring the page.
  if (cachedScope && cachedScope.inputValue === inputValue && cachedScope.readback === readback) return cachedScope;
  const inputs = [
    ...element.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input,textarea,select",
    ),
  ];
  if (element.matches("input,textarea,select")) inputs.unshift(element as HTMLInputElement);
  const images =
    scope?.icons === false ? [] : [...element.querySelectorAll<HTMLImageElement>("img")];
  if (element instanceof HTMLImageElement && scope?.icons !== false) images.unshift(element);
  const masked =
    scope?.icons === false
      ? []
      : [element, ...element.querySelectorAll<HTMLElement>(".appearance-icon-mask")]
          .filter((el) => el.classList.contains("appearance-icon-mask"))
          .map((el) => ({ element: el, image: cssMask(el) }));
  const signature = [
    scope?.key,
    scope?.shape,
    readback,
    ...masked.map(({ image }) => `${image?.src}:${image?.complete}`),
    rect.width,
    rect.height,
    clip.x - rect.x,
    clip.y - rect.y,
    clip.width,
    clip.height,
    element.textContent,
    getComputedStyle(element).font,
    ...inputs.map((input) => `${input.value}:${input.scrollLeft}:${input.scrollTop}`),
    ...images.map((img) => `${img.currentSrc}:${img.complete}:${img.naturalWidth}`),
    ...[element, ...element.querySelectorAll(".floating-body,.ui-panel-body")].map(
      (el) => `${el.scrollTop}:${el.scrollLeft}`,
    ),
  ].join("|");
  const key = scope?.key ?? "";
  const masks = cache.get(element) ?? new Map<string, Snapshot>();
  const previous = masks.get(key);
  if (previous?.signature === signature) {
    if (scope) scopes.set(scope, previous);
    return previous;
  }
  const canvas = document.createElement("canvas"),
    scale = Math.min(1.5, 512 / Math.max(clip.width, clip.height));
  canvas.width = Math.max(1, Math.ceil(clip.width * scale));
  canvas.height = Math.max(1, Math.ceil(clip.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: readback });
  if (!context) return null;
  context.scale(scale, scale);
  context.translate(-clip.x, -clip.y);
  context.fillStyle = "white";
  const visible = (el: Element) =>
    !!el.getClientRects().length &&
    !el.closest("[hidden],.ui-drag-source") && !unavailableControl(el) &&
    getComputedStyle(el).visibility !== "hidden";
  const overlaps = (r: DOMRect) =>
    r.right >= clip.x &&
    r.left <= clip.x + clip.width &&
    r.bottom >= clip.y &&
    r.top <= clip.y + clip.height;
  let hasInk = false;
  const text = (value: string, r: DOMRect, style: CSSStyleDeclaration, owner: HTMLElement) => {
    if (!value.trim() || !overlaps(r)) return;
    context.save();
    if (scope?.clip) clipCanvas(context, scope.clip(owner, true));
    hasInk = true;
    context.font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    context.textBaseline = "alphabetic";
    const metric = context.measureText("Mg"),
      ascent = metric.fontBoundingBoxAscent || parseFloat(style.fontSize) * 0.8,
      descent = metric.fontBoundingBoxDescent || parseFloat(style.fontSize) * 0.2;
    context.fillText(value, r.left, r.top + (r.height - ascent - descent) / 2 + ascent);
    context.restore();
  };
  if (scope?.shape === "surface" || scope?.shape === "contour") {
    hasInk = true;
    if (scope.shape === "surface") context.fillRect(rect.x, rect.y, rect.width, rect.height);
    else {
      context.strokeStyle = "white";
      context.lineWidth = 1.5;
      context.strokeRect(
        rect.x + 1,
        rect.y + 1,
        Math.max(0, rect.width - 2),
        Math.max(0, rect.height - 2),
      );
    }
  }
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node: Node | null,
    characters = 0;
  while (
    (!scope?.shape || scope.shape === "glyphs") &&
    (node = walker.nextNode()) &&
    characters < 900
  ) {
    if (
      (scope?.text && !scope.text(node.parentElement!)) ||
      (scope?.node && !scope.node(node)) ||
      !node.textContent?.trim() ||
      !node.parentElement ||
      !visible(node.parentElement) ||
      node.parentElement.closest("script,style,textarea,select")
    )
      continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()],
      value = node.textContent,
      style = getComputedStyle(node.parentElement);
    if (!rects.some(overlaps)) continue;
    if (rects.length === 1) {
      text(value.replace(/\s+/g, " "), rects[0], style, node.parentElement);
      characters += value.length;
    } else
      for (let i = 0; i < value.length && characters < 900; i++, characters++) {
        if (/\s/.test(value[i])) continue;
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const r = range.getBoundingClientRect();
        text(value[i], r, style, node.parentElement);
      }
  }
  for (const input of inputs.slice(0, 30)) {
    if ((scope?.shape && scope.shape !== "glyphs") || (scope?.input && !scope.input(input)))
      continue;
    if (
      !visible(input) ||
      (input instanceof HTMLInputElement &&
        ["range", "checkbox", "color", "file", "hidden", "password"].includes(input.type))
    )
      continue;
    const r = input.getBoundingClientRect(),
      style = getComputedStyle(input);
    if (!overlaps(r)) continue;
    const value =
      input instanceof HTMLSelectElement
        ? (input.selectedOptions[0]?.text ?? "")
        : input.value || (input as HTMLInputElement).placeholder || "";
    const left = r.x + parseFloat(style.paddingLeft || "0"),
      lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    context.save();
    context.beginPath();
    context.rect(
      left,
      r.top + 2,
      Math.max(
        0,
        r.width - parseFloat(style.paddingLeft || "0") - parseFloat(style.paddingRight || "0"),
      ),
      r.height - 4,
    );
    context.clip();
    for (const [i, line] of value.split("\n").slice(0, 20).entries())
      text(
        line,
        new DOMRect(
          left - input.scrollLeft,
          input instanceof HTMLTextAreaElement
            ? r.top + parseFloat(style.paddingTop || "0") + i * lineHeight - input.scrollTop
            : r.top,
          r.width,
          input instanceof HTMLTextAreaElement ? lineHeight : r.height,
        ),
        style,
        input,
      );
    context.restore();
  }
  for (const image of images.slice(0, 20)) {
    if (scope?.shape && scope.shape !== "glyphs") continue;
    if (
      !visible(image) ||
      !image.complete ||
      !image.naturalWidth ||
      !overlaps(image.getBoundingClientRect())
    )
      continue;
    const url = image.currentSrc || image.src;
    if (!url.startsWith("data:") && new URL(url, location.href).origin !== location.origin)
      continue;
    const r = image.getBoundingClientRect(),
      fit = getComputedStyle(image).objectFit;
    const factor = Math.min(r.width / image.naturalWidth, r.height / image.naturalHeight);
    const width = fit === "contain" ? image.naturalWidth * factor : r.width,
      height = fit === "contain" ? image.naturalHeight * factor : r.height;
    try {
      context.save();
      if (scope?.clip) clipCanvas(context, scope.clip(image));
      hasInk = true;
      context.drawImage(
        image,
        r.left + (r.width - width) / 2,
        r.top + (r.height - height) / 2,
        width,
        height,
      );
    } catch {
      /* A loading icon retries on its load event. */
    } finally { context.restore(); }
  }
  if (!scope?.shape || scope.shape === "glyphs")
    for (const { element: owner, image } of masked) {
      if (!image?.complete || !image.naturalWidth || !visible(owner)) continue;
      const r = owner.getBoundingClientRect();
      if (!overlaps(r)) continue;
      context.save();
      if (scope?.clip) clipCanvas(context, scope.clip(owner));
      hasInk = true;
      context.drawImage(image, r.x, r.y, r.width, r.height);
      context.restore();
    }
  const ink = document.createElement("canvas");
  ink.width = canvas.width;
  ink.height = canvas.height;
  const result = { signature, mask: canvas, ink, empty: !hasInk, inputValue, readback };
  masks.set(key, result); cache.set(element, masks);
  if (scope) scopes.set(scope, result);
  return result;
}
/** Draws narrow colored halos and white-hot cores, without capturing pointer input. */
export function drawUILightning(
  context: CanvasRenderingContext2D,
  element: HTMLElement,
  rect: DOMRect,
  fx: SparkleStyle,
  seconds: number,
  seed: number,
  opacity: number,
  animated: boolean,
  budget: number,
  scope?: GlyphScope,
): number {
  const clip = {
    x: Math.max(0, rect.x),
    y: Math.max(0, rect.y),
    width: Math.min(innerWidth, rect.right) - Math.max(0, rect.x),
    height: Math.min(innerHeight, rect.bottom) - Math.max(0, rect.y),
  };
  if (clip.width <= 0 || clip.height <= 0 || budget <= 0) return 0;
  const shape = snapshot(element, rect, clip, scope, true);
  if (!shape || shape.empty) return 0;
  if (!shape.paths) {
    try { shape.paths = alphaContours(shape.mask.getContext("2d")!.getImageData(0, 0, shape.mask.width, shape.mask.height).data, shape.mask.width, shape.mask.height); }
    catch { shape.paths = []; } // Preserve the old safe fallback for unreadable image masks.
  }
  const bolts = lightningBolts(shape.paths, seed, seconds, fx.density, fx.boltLength, animated);
  let segments = 0;
  const groups: typeof bolts[] = [[], [], [], []];
  for (const bolt of bolts) {
    if (segments + bolt.points.length > budget) break;
    groups[Math.min(3, Math.floor(bolt.strength * 4))].push(bolt);
    segments += bolt.points.length;
  }
  context.save();
  context.shadowColor = typeof context.strokeStyle === "string" ? context.strokeStyle : (fx.color ?? "#60ddec");
  context.lineJoin = "round"; context.lineCap = "round";
  // Batch similar strengths: a halo/core pass per band, rather than several
  // shadowed canvas draws per individual bolt. Work is bounded across UI jobs.
  groups.forEach((group, band) => {
    if (!group.length) return;
    context.beginPath();
    for (const bolt of group) bolt.points.forEach((p, i) => {
      const x = clip.x + (p.x + .5) * clip.width, y = clip.y + (.5 - p.y) * clip.height;
      if (i) context.lineTo(x, y); else context.moveTo(x, y);
    });
    const strength = (band + .5) / groups.length;
    context.shadowBlur = 5;
    context.globalAlpha = opacity * fx.intensity * strength * .25;
    context.lineWidth = 3; context.stroke();
    context.shadowBlur = 0;
    context.globalAlpha = opacity * fx.intensity * strength;
    context.lineWidth = .85; context.stroke();
    if (band >= 2) {
      context.strokeStyle = "#ffffff"; context.globalAlpha *= .65;
      context.lineWidth = .4; context.stroke(); context.strokeStyle = context.shadowColor;
    }
  });
  context.restore();
  return segments;
}

type Noise = { ink: ReturnType<typeof createElectricInk>; revision: number; pixels?: ImageData };
type ElectricTile = { noise: Noise; noiseRevision: number; revision: number;
  canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; pixels: ImageData };
const noises = new Map<string, Noise>(), tiles = new Map<string, ElectricTile>();
// Active jobs retain their material even when a many-color page exceeds the
// small shared palette. This prevents eviction/recreation on every frame.
const scopeTiles = new WeakMap<GlyphScope, { key: string; tile: ElectricTile }>();
/** Opaque electric ink replaces glyph interiors; the surrounding surface remains untouched. */
export function drawUIElectricText(
  context: CanvasRenderingContext2D,
  element: HTMLElement,
  rect: DOMRect,
  fx: SparkleStyle,
  seconds: number,
  opacity: number,
  animated: boolean,
  budget: number,
  scope?: GlyphScope,
): number {
  const clip = {
    x: Math.max(0, rect.x),
    y: Math.max(0, rect.y),
    width: Math.min(innerWidth, rect.right) - Math.max(0, rect.x),
    height: Math.min(innerHeight, rect.bottom) - Math.max(0, rect.y),
  };
  if (clip.width <= 0 || clip.height <= 0 || clip.width * clip.height > budget) return 0;
  const shape = snapshot(element, rect, clip, scope);
  if (!shape || shape.empty) return 0;
  const color =
      fx.color ?? (typeof context.strokeStyle === "string" ? context.strokeStyle : "#60ddec"),
    key = `${color}:${fx.density}:${fx.boltLength}:${fx.intensity}:${fx.motion}`;
  const held = scope && scopeTiles.get(scope);
  let tile = held?.key === key ? held.tile : tiles.get(key);
  if (!tile) {
    const noiseKey = `${fx.density}:${fx.boltLength}:${fx.motion}:${animated}`;
    let noise = noises.get(noiseKey);
    if (!noise) {
      if (noises.size >= 32) noises.delete(noises.keys().next().value!);
      noise = { ink: createElectricInk(true), revision: 0 }; noises.set(noiseKey, noise);
    }
    if (tiles.size >= 32) tiles.delete(tiles.keys().next().value!);
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
    const tileContext = canvas.getContext("2d")!;
    tile = { noise, noiseRevision: -1, revision: 0, canvas, context: tileContext, pixels: tileContext.createImageData(128, 128) };
    tiles.set(key, tile);
  }
  if (scope) scopeTiles.set(scope, { key, tile });
  const noise = tile.noise;
  if (noise.ink.update(animated ? seconds : 0, fx.density, fx.boltLength)) {
    noise.revision++;
    noise.pixels = noise.ink.canvas.getContext("2d")!.getImageData(0, 0, 128, 128);
  }
  if (tile.noiseRevision !== noise.revision) {
    const source = noise.pixels!.data, data = tile.pixels.data;
    const rgb = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));
    for (let i = 0; i < data.length; i += 4) {
      const flux = source[i] / 255,
        t = Math.max(0, Math.min(1, (flux - 0.68) / 0.3)), core = t * t * (3 - 2 * t);
      for (let c = 0; c < 3; c++) data[i + c] = (rgb[c] * (0.16 + flux * 1.25) + core * 230) * (0.35 + fx.intensity * 0.65);
      data[i + 3] = source[i + 3];
    }
    tile.context.putImageData(tile.pixels, 0, 0);
    tile.noiseRevision = noise.revision; tile.revision++;
  }
  if (shape.paint?.tile !== tile || shape.paint.revision !== tile.revision) {
    const ink = shape.ink.getContext("2d")!;
    ink.globalCompositeOperation = "copy"; ink.drawImage(shape.mask, 0, 0);
    ink.globalCompositeOperation = "source-in";
    ink.fillStyle = ink.createPattern(tile.canvas, "repeat")!;
    ink.fillRect(0, 0, shape.ink.width, shape.ink.height);
    shape.paint = { tile, revision: tile.revision };
  }
  context.save();
  context.globalAlpha = opacity;
  context.shadowBlur = 0;
  context.drawImage(shape.ink, clip.x, clip.y, clip.width, clip.height);
  context.restore();
  return clip.width * clip.height;
}
