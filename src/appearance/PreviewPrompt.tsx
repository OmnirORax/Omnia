import { useEffect, useRef } from "react";
import { FloatingWindow } from "../ui/FloatingWindow";
import { FunctionControl } from "../ui/UIWorkspace";
import { UIAction } from "../ui/UIAction";
import { claimUIPress } from "../ui/pointerOwnership";
import { PAGE_INPUT_SUSPEND } from "../ui/pageInputBoundary";

/** Everyday preview actions participate in normal shared UI discovery/styling. */
export function AppearancePreviewActions({ pending, safe, onSafe }: {
  pending: boolean; safe: boolean; onSafe: () => void;
}) {
  return <section className="appearance-preview-actions" aria-label="Appearance preview" data-appearance-editor>
    <p role="status">{pending ? "Appearance preview · not saved" : "Safe view · saved appearance unchanged"}</p>
    <div className="appearance-preview-buttons">
      {pending && <><FunctionControl id="ui:appearance:apply" mirror /><FunctionControl id="ui:appearance:discard" mirror /></>}
      {safe && <UIAction id="ui:appearance:showCustom" label="Show custom appearance" category="Appearance" onClick={onSafe} />}
      <FunctionControl id="ui:appearance:recovery" mirror />
    </div>
  </section>;
}

export function AppearancePreviewPrompt({ onContinue, safe, onSafe }: {
  onContinue: () => void; safe: boolean; onSafe: () => void;
}) {
  const callback = useRef(onContinue); callback.current = onContinue;
  useEffect(() => {
    const panel = document.querySelector<HTMLElement>('[data-ui-resident-root="window:appearance-preview"]');
    const previous = document.activeElement as HTMLElement | null;
    panel?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopImmediatePropagation(); callback.current();
      } else if (event.key === "Tab") {
        const controls = [...(panel?.querySelectorAll<HTMLElement>('button:not(:disabled):not([aria-disabled="true"]),input:not(:disabled),select:not(:disabled)') ?? [])];
        const index = controls.indexOf(document.activeElement as HTMLElement);
        const next = event.shiftKey ? controls[(index <= 0 ? controls.length : index) - 1] : controls[(index + 1) % controls.length];
        if (next) { event.preventDefault(); event.stopImmediatePropagation(); next.focus(); }
      }
    };
    window.addEventListener("keydown", key, true);
    return () => { window.removeEventListener("keydown", key, true); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <FloatingWindow id="appearance-preview" title="Unsaved appearance" width={390} height={230} modal onClose={onContinue}>
    <p>Apply or discard your appearance changes before leaving Master Controller.</p>
    <AppearancePreviewActions pending safe={safe} onSafe={onSafe} />
    <UIAction id="ui:appearance:continueEditing" label="Keep editing" category="Appearance" onClick={onContinue} />
  </FloatingWindow>;
}

/** Click-time only: no pointer tracking, geometry reads or background observers. */
export function AppearancePreviewLeaveGuard({ enabled, onLeave }: { enabled: boolean; onLeave: () => void }) {
  const callback = useRef(onLeave); callback.current = onLeave;
  const consumed = useRef(false);
  useEffect(() => {
    const reset = () => { consumed.current = false; };
    const tail = (event: MouseEvent) => {
      if (!event.isTrusted || !consumed.current) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.type === "click" || event.type === "auxclick") reset();
    };
    window.addEventListener("pointerdown", reset, true);
    for (const type of ["mousedown", "mouseup", "click", "auxclick"] as const) window.addEventListener(type, tail, true);
    window.addEventListener(PAGE_INPUT_SUSPEND, reset);
    return () => {
      window.removeEventListener("pointerdown", reset, true);
      for (const type of ["mousedown", "mouseup", "click", "auxclick"] as const) window.removeEventListener(type, tail, true);
      window.removeEventListener(PAGE_INPUT_SUSPEND, reset);
    };
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const down = (event: PointerEvent) => {
      if (!event.isTrusted || event.button !== 0 || !(event.target instanceof Element)) return;
      // Aiming the visual selector is part of editing; external browser chrome
      // emits no page pointer event and must never open this prompt.
      if (document.documentElement.hasAttribute("data-visual-selecting")) return;
      if (event.target.closest('[data-appearance-editor],[data-ui-resident-root="window:theme"],[data-ui-resident-root="window:appearance-preview"],omnium-appearance-recovery')) return;
      consumed.current = true;
      claimUIPress(event.pointerId, event.pointerType, event.buttons);
      event.preventDefault(); event.stopImmediatePropagation(); callback.current();
    };
    window.addEventListener("pointerdown", down, true);
    return () => window.removeEventListener("pointerdown", down, true);
  }, [enabled]);
  return null;
}
