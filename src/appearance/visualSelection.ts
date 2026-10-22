import { TARGETS, type RegisteredTarget } from "./registry";
import { effectScope } from "./uiEffects";

export type VisualRole = "text" | "background" | "contour" | "icon" | "indicator";
export type VisualPart = {
  key: string;
  element: HTMLElement | SVGElement;
  target: RegisteredTarget;
  role: VisualRole;
  range?: Range;
};
export type SelectionBoundary = {
  element: Element;
  attribute?: "data-ui-function" | "data-ui-resident-root";
  value?: string;
  key: string;
};
export type SelectionRule = {
  include: boolean;
  boundary: SelectionBoundary;
  role?: VisualRole;
  part?: string;
};
export type SelectorMode = "boundary" | "item" | "pattern";
export const selectorChrome = "[data-visual-selector]";
const ignored = `${selectorChrome},[hidden],[data-shortcut-runner],[data-ui-palette],[data-ui-native-hidden],omnium-appearance-recovery`;
const ids = new WeakMap<Node, number>();
let sequence = 0;
const keyFor = (node: Node) => {
  let key = ids.get(node);
  if (!key) { key = ++sequence; ids.set(node, key); }
  return key;
};
export function roleFor(target: RegisteredTarget): VisualRole | undefined {
  if (target.binding?.text) return "text";
  if (target.binding?.animation?.kind === "icons") return "icon";
  return ({ "background-color": "background", "border-color": "contour", "accent-color": "indicator" } as const)[
    target.binding?.css as "background-color" | "border-color" | "accent-color"
  ];
}
const visible = (element: Element) => !element.closest(ignored) && !!element.getClientRects().length &&
  getComputedStyle(element).visibility !== "hidden";

/** Discover real UI parts from the same bindings used by the hierarchy/renderers. */
export function collectVisualParts(): VisualPart[] {
  const parts: VisualPart[] = [];
  const queries = new Map<string, Element[]>();
  const seen = new Set<string>();
  for (const target of TARGETS) {
    if (target.aggregate || !target.binding?.selector) continue;
    const role = roleFor(target);
    if (!role) continue;
    const selector = (role === "icon" ? target.binding.animation?.selector ?? target.binding.selector : target.binding.selector)
      .replace(/::placeholder/g, "");
    let elements = queries.get(selector);
    if (!elements) {
      elements = [...document.querySelectorAll(selector)].filter(visible);
      queries.set(selector, elements);
    }
    for (const element of elements) {
      if (!(element instanceof HTMLElement || element instanceof SVGElement)) continue;
      const add = (node: Node, range?: Range) => {
        const key = `${target.id}:${keyFor(node)}`;
        if (seen.has(key)) return;
        seen.add(key);
        const parent = range?.startContainer.parentElement ?? element;
        if (!(parent instanceof HTMLElement || parent instanceof SVGElement)) return;
        parts.push({ key, element: parent, target, role, range });
      };
      if (role === "text" && element instanceof HTMLElement) {
        const scope = effectScope(target, element);
        if (element.matches("input,textarea,select")) {
          if (element.matches('input[type="checkbox"],input[type="radio"],input[type="range"],input[type="color"],input[type="hidden"]')) continue;
          if (scope.input?.(element)) add(element);
          continue;
        }
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const parent = node.parentElement;
          if (!node.textContent?.trim() || !parent || !visible(parent) || !scope.text?.(parent)) continue;
          const range = document.createRange(); range.selectNodeContents(node);
          if ([...range.getClientRects()].some(rect => rect.width > 0 && rect.height > 0)) add(node, range);
        }
      } else {
        if (role === "contour") {
          const style = getComputedStyle(element);
          if (!["Top", "Right", "Bottom", "Left"].some(side =>
            parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 &&
            style.getPropertyValue(`border-${side.toLowerCase()}-style`) !== "none")) continue;
        }
        add(element);
      }
    }
  }
  return parts;
}

export function boundaryFor(element: Element): SelectionBoundary {
  const attribute = element.hasAttribute("data-ui-function") ? "data-ui-function" :
    element.hasAttribute("data-ui-resident-root") ? "data-ui-resident-root" : undefined;
  const value = attribute ? element.getAttribute(attribute)! : undefined;
  return { element, attribute, value,
    key: element === document.body ? "app" : attribute ? `${attribute}:${value}` : `element:${keyFor(element)}` };
}
export function boundaryElement(boundary: SelectionBoundary): Element | undefined {
  if (boundary.element.isConnected && visible(boundary.element)) return boundary.element;
  if (boundary.attribute && boundary.value)
    return [...document.querySelectorAll(`[${boundary.attribute}="${CSS.escape(boundary.value)}"]`)].find(visible);
}
export function boundaryCandidates(element: Element): SelectionBoundary[] {
  const candidates: SelectionBoundary[] = [];
  for (let node: Element | null = element; node && node !== document.body; node = node.parentElement) {
    if (node.matches("[data-ui-resident-root],[data-ui-function],button,input,textarea,select,.toolbar,.sidebar,.ui-dock-group,.ui-dock-split"))
      candidates.push(boundaryFor(node));
  }
  candidates.push(boundaryFor(document.body));
  return candidates;
}
const containsPoint = (rect: DOMRect, x: number, y: number) =>
  x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
export function partAt(parts: VisualPart[], element: Element, x: number, y: number): VisualPart | undefined {
  const candidates = parts.filter(part => part.element === element || part.element.contains(element));
  // Artwork, actual text ink, then border proximity distinguish overlapping paint
  // on the same component. Background is the final fallback, not the text's box.
  const icon = candidates.find(part => part.role === "icon" && containsPoint(part.element.getBoundingClientRect(), x, y));
  if (icon) return icon;
  const text = candidates.find(part => part.role === "text" && part.range &&
    [...part.range.getClientRects()].some(rect => containsPoint(rect, x, y)));
  if (text) return text;
  const depth = (part: VisualPart) => {
    let node: Element | null = element, depth = 0;
    while (node && node !== part.element) { depth++; node = node.parentElement; }
    return depth;
  };
  candidates.sort((a, b) => depth(a) - depth(b));
  const contour = candidates.find(part => {
    if (part.role !== "contour") return false;
    const rect = part.element.getBoundingClientRect();
    return containsPoint(rect, x, y) && Math.min(x - rect.left, rect.right - x, y - rect.top, rect.bottom - y) <= 5;
  });
  return contour ?? candidates.find(part => part.role === "indicator") ??
    candidates.find(part => part.role === "text" && !part.range &&
      part.element.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),textarea,select')) ??
    candidates.find(part => part.role === "background");
}
export function matchingVisualParts(parts: VisualPart[], rule: SelectionRule): VisualPart[] {
  const root = boundaryElement(rule.boundary);
  return root ? parts.filter(part => root.contains(part.element) &&
    (!rule.role || rule.role === part.role) && (!rule.part || rule.part === part.key)) : [];
}
export function resolveVisualSelection(parts: VisualPart[], boundary: SelectionBoundary | null, rules: SelectionRule[]): VisualPart[] {
  if (!boundary) return [];
  const root = boundaryElement(boundary);
  if (!root) return [];
  const compiled = rules.map(rule => ({ rule, root: boundaryElement(rule.boundary) }));
  return parts.filter(part => {
    if (!root.contains(part.element)) return false;
    let included = false;
    for (const { rule, root } of compiled)
      if (root?.contains(part.element) && (!rule.role || rule.role === part.role) && (!rule.part || rule.part === part.key))
        included = rule.include;
    return included;
  });
}
