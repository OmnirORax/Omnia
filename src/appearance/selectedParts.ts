import { PART_KEYS, normalizePartScope, type PartStep } from "./partScope.ts";
import type { SelectedPart } from "./selectionCoupling";
import type { VisualPart } from "./visualSelection";

/** A nearest stable UI owner follows docking/reparenting. Structural steps are a fallback for unkeyed markup. */
export function describeSelectedPart(part: VisualPart): SelectedPart | undefined {
  // Renderer snapshots can outlive their DOM for one catalog-refresh frame.
  // Keep membership/rules intact, but never address a removed visual host.
  if(part.element.isConnected===false||part.range?.startContainer.isConnected===false)return;
  if (part.target.binding?.selection?.address === "target")
    return { base: part.target.id, owner: "app", part: { steps: [] }, label: part.target.label };

  if (part.range && (typeof Highlight === "undefined" || !CSS.highlights)) return;
  const element = part.element;
  const root = element.closest("[data-ui-function],[data-ui-resident-root],[data-ui-proxy-for]") ?? document.body;
  const fn = root.getAttribute("data-ui-function");
  const owner = fn ? `function:${fn}` : root.getAttribute("data-ui-resident-root") ?? root.getAttribute("data-ui-proxy-for") ?? "app";
  const steps: PartStep[] = [];
  for (let node: Element | null = element; node && node !== root; node = node.parentElement) {
    const parent=node.parentElement;if(!parent)return;
    const key = PART_KEYS.find(key => node!.hasAttribute(key));
    steps.unshift({ tag: node.localName, index: [...parent.children].filter(child => child.localName === node!.localName).indexOf(node) + 1,
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

/** A complete text host can use the existing CSS/font and glyph-effect adapter.
 * Partial text runs keep their exact range adapter instead of widening scope. */
export function describeSelectedParts(parts: VisualPart[]): SelectedPart[] {
  const selectedNodes = new Set(parts.flatMap(part => part.range ? [part.range.startContainer] : []));
  const result = parts.flatMap(part => {
    const selected = describeSelectedPart(part);
    if (!selected) return [];
    if (part.range) {
      const walker = document.createTreeWalker(part.element, NodeFilter.SHOW_TEXT);
      let complete = true;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.textContent?.trim() && !selectedNodes.has(node)) { complete = false; break; }
      }
      if (complete) {
        const { text: _text, ...host } = selected.part;
        return [{ ...selected, part: host }];
      }
    }
    return [selected];
  });
  return [...new Map(result.map(part => [JSON.stringify([part.base, part.owner, part.part]), part])).values()];
}
