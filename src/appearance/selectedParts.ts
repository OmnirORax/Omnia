import { PART_KEYS, normalizePartScope, type PartStep } from "./partScope";
import type { SelectedPart } from "./selectionCoupling";
import type { VisualPart } from "./visualSelection";

/** A nearest stable UI owner follows docking/reparenting. Structural steps are a fallback for unkeyed markup. */
export function describeSelectedPart(part: VisualPart): SelectedPart | undefined {
  if (part.range && (typeof Highlight === "undefined" || !CSS.highlights)) return;
  const element = part.element;
  const root = element.closest("[data-ui-function],[data-ui-resident-root],[data-ui-proxy-for]") ?? document.body;
  const fn = root.getAttribute("data-ui-function");
  const owner = fn ? `function:${fn}` : root.getAttribute("data-ui-resident-root") ?? root.getAttribute("data-ui-proxy-for") ?? "app";
  const steps: PartStep[] = [];
  for (let node: Element | null = element; node && node !== root; node = node.parentElement) {
    const key = PART_KEYS.find(key => node!.hasAttribute(key));
    steps.unshift({ tag: node.localName, index: [...node.parentElement!.children].filter(child => child.localName === node!.localName).indexOf(node) + 1,
      ...(key ? { key, value: node.getAttribute(key)! } : {}) });
  }
  const textNodes = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
  const text = part.range ? textNodes.indexOf(part.range.startContainer as ChildNode) : undefined;
  const scope = normalizePartScope({ steps, ...(text !== undefined ? { text } : {}) });
  if (!scope) return;
  const path: string[] = [];
  for (let ancestor = element.closest("[data-ui-resident-root]"); ancestor; ancestor = ancestor.parentElement?.closest("[data-ui-resident-root]") ?? null)
    path.unshift(ancestor.getAttribute("data-ui-resident-root")!);
  const caption = (root.getAttribute("aria-label") ?? root.querySelector("[data-ui-inline-handle],.ui-frame-handle")?.textContent ?? "").trim().slice(0, 100);
  return { base: part.target.id, owner, part: scope, path,
    label: `${caption || part.target.label} · ${part.role}${text !== undefined ? ` ${text + 1}` : ""}` };
}
