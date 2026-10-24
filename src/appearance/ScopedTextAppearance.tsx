import { useEffect, useMemo, useRef } from "react";
import { stableUIHash } from "../ui/identity";
import { useAppearance } from "./Context";
import { partSelector } from "./partScope";
import { tint } from "./resolve";
import { textOwner } from "./uiEffects";
import { TARGETS } from "./registry";
import { APPEARANCE_EDITOR } from "./interactionHold";

/** Persistent glyph paint uses the same controller values, without recoloring surrounding controls. */
export function ScopedTextAppearance() {
  const ctx = useAppearance();
  const current = useRef(ctx); current.current = ctx;
  const repaint = useRef<(() => void) | null>(null);
  const targets = useMemo(() => ctx?.targets.filter(target => target.instance?.part?.text !== undefined) ?? [], [ctx?.targets]);
  useEffect(() => {
    if (!ctx || ctx.safe || !targets.length || typeof Highlight === "undefined" || !CSS.highlights) return;
    const style = document.createElement("style");
    style.setAttribute("data-appearance-parts", "");
    document.head.append(style);
    let frame = 0;
    const names = new Set<string>(), hosts = new Set<Element>();
    const paint = () => {
      const appearance = current.current;
      if (!appearance) return;
      const rules = targets.map(target => {
        const get = (property: string) => appearance.read(target, property);
        const color = String(get("color")), brightness = Number(get("brightness")), opacity = Number(get("opacity")), glow = Number(get("glow"));
        const ink = tint(color, brightness, opacity);
        return `::highlight(omnium-part-${stableUIHash(target.id)}){color:${ink};text-shadow:${glow > 0 ? `0 0 ${glow * 10}px ${ink}` : "none"}}`;
      });
      const css = rules.join("\n");
      if (style.textContent !== css) style.textContent = css;
    };
    const bind = () => {
      frame = 0;
      hosts.clear();
      for (const name of names) CSS.highlights.delete(name);
      names.clear();
      for (const target of targets) {
        const instance = target.instance!, base = TARGETS.find(base => base.id === instance.base)!;
        const ranges: Range[] = [];
        for (const element of document.querySelectorAll(partSelector(instance))) {
          if (!(element instanceof HTMLElement) || element.closest("[hidden],[data-ui-native-hidden],[data-visual-selector]")) continue;
          hosts.add(element);
          // Verify registered ownership only on binding/structure changes, not
          // on every native picker input. Existing Ranges follow their text nodes.
          if (textOwner(element)?.target.id !== base.id) continue;
          const node = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())[instance.part!.text!];
          if (!node) continue;
          const range = document.createRange(); range.selectNodeContents(node); ranges.push(range);
        }
        const name = `omnium-part-${stableUIHash(target.id)}`;
        CSS.highlights.set(name, new Highlight(...ranges)); names.add(name);
      }
      paint();
    };
    const refresh = () => { if (!frame) frame = requestAnimationFrame(bind); };
    const observer = new MutationObserver(records => {
      if (records.some(record => {
        const element = record.target instanceof Element ? record.target : record.target.parentElement;
        if (!element || element.closest(`[data-visual-selector],${APPEARANCE_EDITOR},style,script,canvas`)) return false;
        return !hosts.size || [...hosts].some(host => element.contains(host) || host.contains(element));
      })) refresh();
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ["class", "hidden", "open", "data-ui-native-hidden", "data-ui-function", "data-ui-resident-root"] });
    repaint.current = paint;
    bind();
    return () => {
      repaint.current = null; observer.disconnect(); cancelAnimationFrame(frame); style.remove();
      for (const name of names) CSS.highlights.delete(name);
    };
  }, [targets, ctx?.safe]);
  // Paint-only edits reuse bound ranges and update only their shared stylesheet.
  useEffect(() => { repaint.current?.(); }, [ctx?.base, ctx?.state, ctx?.targets]);
  return null;
}
