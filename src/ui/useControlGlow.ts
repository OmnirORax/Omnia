import { useEffect, useRef } from "react";

/** Reuse native controls and their actual colors; no custom slider implementation. */
export function useControlGlow(strength: number, accent: string, theme: string) {
  const enabled = strength > 0;
  const requestScan = useRef<() => void>(() => {});
  useEffect(() => { requestScan.current(); }, [accent, theme]);
  useEffect(() => {
    if (!enabled) return;
    const selector = 'input[type="color"],input[type="range"],progress,meter';
    const decorated = new Set<HTMLElement>();
    let frame = 0;
    const apply = (element: HTMLElement) => {
      const color = element instanceof HTMLInputElement && element.type === "color" ? element.value : getComputedStyle(element).accentColor;
      const nativeAccent = CSS.supports("color", "AccentColor") ? "AccentColor" : "#0075ff";
      const value = color && color !== "auto" ? color : nativeAccent;
      if (element.style.getPropertyValue("--omnium-control-color") !== value) element.style.setProperty("--omnium-control-color", value);
      decorated.add(element);
    };
    const scan = () => {
      frame = 0;
      for (const element of decorated) if (!element.isConnected) decorated.delete(element);
      document.querySelectorAll<HTMLElement>(selector).forEach(apply);
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(scan); };
    requestScan.current = request;
    const input = (event: Event) => { if (event.target instanceof HTMLElement && event.target.matches(selector)) apply(event.target); };
    const observer = new MutationObserver(records => {
      // Camera guides and animated labels can change every frame; only controls need a scan.
      if (records.some(record => record.type === "attributes" ? record.target instanceof Element && record.target.matches(selector) : [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element && (node.matches(selector) || node.querySelector(selector))))) request();
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["value", "type"] });
    document.addEventListener("input", input, true); document.addEventListener("change", input, true); scan();
    return () => {
      requestScan.current = () => {};
      observer.disconnect(); cancelAnimationFrame(frame);
      document.removeEventListener("input", input, true); document.removeEventListener("change", input, true);
      for (const element of decorated) element.style.removeProperty("--omnium-control-color");
    };
  }, [enabled]);
}
