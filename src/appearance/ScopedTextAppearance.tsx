import { useEffect } from "react";
import { stableUIHash } from "../ui/identity";
import { useAppearance } from "./Context";
import { partSelector } from "./partScope";
import { tint, createValueResolver } from "./resolve";
import { textOwner } from "./uiEffects";
import { TARGETS } from "./registry";

/** Persistent glyph paint uses the same controller values, without recoloring surrounding controls. */
export function ScopedTextAppearance() {
  const ctx = useAppearance();
  useEffect(() => {
    if (!ctx || ctx.safe || typeof Highlight === "undefined" || !CSS.highlights) return;
    const targets = ctx.targets.filter(target => target.instance?.part?.text !== undefined);
    if (!targets.length) return;
    const read = createValueResolver(ctx.base, ctx.state, ctx.targets);
    const style = document.createElement("style");
    style.setAttribute("data-appearance-parts", "");
    document.head.append(style);
    let frame = 0;
    const names = new Set<string>();
    const paint = () => {
      frame = 0;
      for (const name of names) CSS.highlights.delete(name);
      names.clear();
      const rules: string[] = [];
      for (const target of targets) {
        const instance = target.instance!, base = TARGETS.find(base => base.id === instance.base)!;
        const ranges: Range[] = [];
        for (const element of document.querySelectorAll(partSelector(instance))) {
          if (!(element instanceof HTMLElement) || element.closest("[hidden],[data-ui-native-hidden],[data-visual-selector]")) continue;
          // Verify the registered text owner still owns this part after a remount.
          if (textOwner(element)?.target.id !== base.id) continue;
          const node = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())[instance.part!.text!];
          if (!node) continue;
          const range = document.createRange(); range.selectNodeContents(node); ranges.push(range);
        }
        const name = `omnium-part-${stableUIHash(target.id)}`;
        CSS.highlights.set(name, new Highlight(...ranges)); names.add(name);
        const get = (property: string) => read(target, property);
        const color = String(get("color")), brightness = Number(get("brightness")), opacity = Number(get("opacity")), glow = Number(get("glow"));
        const ink = tint(color, brightness, opacity);
        rules.push(`::highlight(${name}){color:${ink};text-shadow:${glow > 0 ? `0 0 ${glow * 10}px ${ink}` : "none"}}`);
      }
      style.textContent = rules.join("\n");
    };
    const refresh = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const observer = new MutationObserver(records => {
      if (records.some(record => !(record.target instanceof Element ? record.target : record.target.parentElement)?.closest("[data-visual-selector]"))) refresh();
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ["class", "hidden", "open", "data-ui-native-hidden", "data-ui-function", "data-ui-resident-root"] });
    paint();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); style.remove(); for (const name of names) CSS.highlights.delete(name); };
  }, [ctx?.base, ctx?.state, ctx?.targets, ctx?.safe]);
  return null;
}
