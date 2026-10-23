import { useEffect, useRef } from "react";
import { UIAction } from "../ui/UIAction";
import { FunctionControl } from "../ui/UIWorkspace";

/** A leave request draws attention to the existing choices without opening a popup. */
export function AppearancePreviewActions({ awaitingChoice = false, onContinue }: {
  awaitingChoice?: boolean; onContinue: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const callback = useRef(onContinue); callback.current = onContinue;
  useEffect(() => {
    if (!awaitingChoice) return;
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat) return;
      event.preventDefault(); event.stopImmediatePropagation(); callback.current();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [awaitingChoice]);
  return <div ref={root} className={`appearance-preview-buttons${awaitingChoice ? " needs-choice" : ""}`}
    role="group" aria-label={awaitingChoice ? "Unsaved appearance: apply, discard or cancel" : "Appearance preview actions"}
    data-appearance-editor>
    <FunctionControl id="ui:appearance:apply" mirror />
    <FunctionControl id="ui:appearance:discard" mirror />
    {awaitingChoice ? <UIAction id="ui:appearance:cancelLeave" label="Cancel" category="Appearance" onClick={onContinue} />
      : <FunctionControl id="ui:appearance:recovery" mirror />}
  </div>;
}
