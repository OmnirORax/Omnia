import { useActiveLayer } from "../ui/ActiveContext";
import { useRef } from "react";
import { UIAction } from "../ui/UIAction";
import { FunctionControl } from "../ui/UIWorkspace";

/** A leave request draws attention to the existing choices without opening a popup. */
export function AppearancePreviewActions({ awaitingChoice = false, onContinue }: {
  awaitingChoice?: boolean; onContinue: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const callback = useRef(onContinue); callback.current = onContinue;
  useActiveLayer(awaitingChoice, root, () => callback.current(), "window:theme");
  return <div ref={root} className={`appearance-preview-buttons${awaitingChoice ? " needs-choice" : ""}`}
    role="group" aria-label={awaitingChoice ? "Unsaved appearance: apply, discard or cancel" : "Appearance preview actions"}
    data-appearance-editor>
    <FunctionControl id="ui:appearance:apply" mirror />
    <FunctionControl id="ui:appearance:discard" mirror />
    {awaitingChoice ? <UIAction id="ui:appearance:cancelLeave" label="Cancel" category="Appearance" onClick={onContinue} />
      : <FunctionControl id="ui:appearance:recovery" mirror />}
  </div>;
}
