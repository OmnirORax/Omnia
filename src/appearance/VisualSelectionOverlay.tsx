import { useEffect } from "react";
import { boundaryElement, type SelectionBoundary, type SelectionRule, type VisualPart } from "./visualSelection";

type Mark = { key: string; x: number; y: number; width: number; height: number; radius: string; role: VisualPart["role"] };
const geometry = (part: VisualPart): Mark | undefined => {
  if (part.range || part.role === "icon" || part.role === "text") return;
  const rect = part.element.getBoundingClientRect();
  if (!rect.width || !rect.height || rect.bottom < 0 || rect.right < 0 || rect.top > innerHeight || rect.left > innerWidth) return;
  return { key: part.key, x: rect.x, y: rect.y, width: rect.width, height: rect.height,
    radius: getComputedStyle(part.element).borderTopLeftRadius, role: part.role };
};
/** Selection paint is separate from appearance values and never changes layout. */
export function VisualSelectionOverlay({ selected, preview, candidate, boundary }: {
  selected: VisualPart[]; preview: VisualPart[]; candidate: SelectionRule | null; boundary: SelectionBoundary | null;
}) {
  useEffect(() => {
    const names = ["omnium-selector-selected", "omnium-selector-preview"];
    if (typeof Highlight !== "undefined" && CSS.highlights) {
      CSS.highlights.set(names[0], new Highlight(...selected.flatMap(part => part.range ? [part.range] : [])));
      CSS.highlights.set(names[1], new Highlight(...preview.flatMap(part => part.range ? [part.range] : [])));
    }
    const paint = new Map<HTMLElement | SVGElement, { key: string; ink: string }>();
    for (const [parts, ink] of [[selected, "var(--omnium-accent,#60ddec)"], [preview, candidate?.include === false ? "#ff927e" : "#a1f3c4"]] as const) {
      for (const part of parts) {
        if (part.range || !(part.role === "icon" || part.role === "text")) continue;
        const element = part.element, key = part.role === "icon" ? "filter" : "color";
        paint.set(element, { key, ink });
      }
    }
    // Own a temporary CSS layer rather than overwrite the inline paint used by
    // the hierarchy preview and renderers. Read all paint before marking nodes.
    const attribute = "data-visual-selection-ink";
    const plans = [...paint].map(([element, { key, ink }], index) => {
      const computed = getComputedStyle(element).getPropertyValue(key);
      return { element, marker: `selection-${index}`, previous: element.getAttribute(attribute),
        declaration: `${key}:${key === "filter" ? `${computed === "none" ? "" : computed} drop-shadow(0 0 4px ${ink})` : ink}!important` };
    });
    const style = document.createElement("style");
    style.setAttribute("data-visual-selector", "");
    style.textContent = plans.map(plan => `:root:root:root [${attribute}="${plan.marker}"]{${plan.declaration}}`).join("\n");
    document.head.append(style);
    for (const plan of plans) plan.element.setAttribute(attribute, plan.marker);
    return () => {
      for (const name of names) CSS.highlights?.delete(name);
      style.remove();
      for (const { element, marker, previous } of plans) {
        if (element.getAttribute(attribute) !== marker) continue;
        if (previous === null) element.removeAttribute(attribute); else element.setAttribute(attribute, previous);
      }
    };
  }, [selected, preview, candidate?.include]);
  const marks = selected.map(geometry).filter((mark): mark is Mark => !!mark);
  const candidates = preview.map(geometry).filter((mark): mark is Mark => !!mark);
  const rectFor = (anchor: SelectionBoundary | null) => {
    const root = anchor && boundaryElement(anchor);
    return root === document.body ? { x: 3, y: 3, width: innerWidth - 6, height: innerHeight - 6 } : root?.getBoundingClientRect();
  };
  const edge = rectFor(boundary), hover = rectFor(candidate?.boundary ?? null);
  return <div data-visual-selector className={`visual-selection-overlay ${candidate?.include === false ? "is-excluding" : ""}`}>
    <style>{`::highlight(omnium-selector-selected){background-color:#60ddec35}::highlight(omnium-selector-preview){background-color:${candidate?.include === false ? "#ff927e77" : "#a1f3c477"}}`}</style>
    <svg aria-hidden="true" width="100%" height="100%">
      {marks.map(mark => <rect key={mark.key} {...{ x: mark.x, y: mark.y, width: mark.width, height: mark.height }}
        rx={mark.radius} className={`visual-selected-part role-${mark.role}`} />)}
      {candidates.map(mark => <rect key={mark.key} {...{ x: mark.x, y: mark.y, width: mark.width, height: mark.height }}
        rx={mark.radius} className={`visual-preview-part role-${mark.role}`} />)}
      {edge && <rect {...{ x: edge.x, y: edge.y, width: Math.max(0, edge.width), height: Math.max(0, edge.height) }} rx="4" className="visual-selected-boundary" />}
      {hover && candidate && !candidate.part && <rect {...{ x: hover.x, y: hover.y, width: Math.max(0, hover.width), height: Math.max(0, hover.height) }} rx="4" className="visual-preview-boundary" />}
    </svg>
  </div>;
}
