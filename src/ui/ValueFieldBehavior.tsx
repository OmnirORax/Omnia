import { useEffect } from "react";

const valueField = (target: EventTarget | null): HTMLInputElement | null =>
  target instanceof HTMLInputElement && !target.disabled && !target.readOnly &&
  (target.type === "number" || target.inputMode === "decimal" || target.inputMode === "numeric")
    ? target : null;

/** Shared by native, registered and portalled numeric value editors. */
export function ValueFieldBehavior() {
  useEffect(() => {
    let press: { field: HTMLInputElement; x: number; y: number } | null = null;
    const down = (event: MouseEvent) => {
      const field = valueField(event.target);
      press = event.button === 0 && field && document.activeElement !== field
        ? { field, x: event.clientX, y: event.clientY } : null;
    };
    const focus = (event: FocusEvent) => { valueField(event.target)?.select(); };
    const up = (event: MouseEvent) => {
      const pending = press;
      press = null;
      if (!pending || event.button !== 0 || event.target !== pending.field ||
          document.activeElement !== pending.field ||
          Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 4) return;
      // The first click must not collapse the selection established on focus.
      event.preventDefault();
      pending.field.select();
    };
    const cancel = () => { press = null; };
    document.addEventListener("mousedown", down, true);
    document.addEventListener("focusin", focus);
    document.addEventListener("mouseup", up);
    window.addEventListener("blur", cancel);
    return () => {
      document.removeEventListener("mousedown", down, true);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("mouseup", up);
      window.removeEventListener("blur", cancel);
    };
  }, []);
  return null;
}
