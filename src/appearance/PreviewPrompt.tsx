import { useEffect, useRef } from "react";
import { FunctionControl } from "../ui/UIWorkspace";

/** One compact action strip; a leave request promotes it to an attached popover. */
export function AppearancePreviewActions({ prompted = false, onContinue }: {
  prompted?: boolean; onContinue: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const callback = useRef(onContinue); callback.current = onContinue;
  useEffect(() => {
    if (!prompted) return;
    const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLButtonElement>('button[data-ui-function="ui:appearance:apply"]')?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat) return;
      event.preventDefault(); event.stopImmediatePropagation(); callback.current();
    };
    window.addEventListener("keydown", key, true);
    return () => { window.removeEventListener("keydown", key, true); if (previous?.isConnected) previous.focus(); };
  }, [prompted]);
  return <div ref={root} className={`appearance-preview-buttons${prompted ? " is-prompt" : ""}`}
    role={prompted ? "dialog" : "group"} aria-label={prompted ? "Unsaved appearance: apply, discard or recovery" : "Appearance preview actions"}
    data-appearance-editor>
    <FunctionControl id="ui:appearance:apply" mirror />
    <FunctionControl id="ui:appearance:discard" mirror />
    <FunctionControl id="ui:appearance:recovery" mirror />
  </div>;
}
