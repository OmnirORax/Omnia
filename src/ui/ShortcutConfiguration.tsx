import { CoupledActionConfiguration } from "./CoupledActionConfiguration";
import { ConfigurationInteractionBoundary } from "./ConfigurationInteraction";
import { createConfigurationGesture } from "./configurationGesture";
import { useLayoutEffect, useRef, useState } from "react";
import { ACTIONS, isTypingTarget, normalizeKey, normalizePointer, type WorkspaceSettings } from "../workspaceActions";
import { featureActionRuntime, recordShortcutPress, recordedShortcutTail } from "../featureActions";
import type { PropertyBindings } from "../properties/CoupledProperties";
import { useUI } from "./context";
import { ContextualMasterController } from "./ContextualMasterController";
import { ACTION_CONFIGURATION_EVENT, configurationTarget } from "./shortcutConfiguration";
import { claimUIPress } from "./pointerOwnership";
export function ShortcutConfiguration({ mouse, bindings }: { mouse: WorkspaceSettings["mouse"]; bindings: PropertyBindings }) {
  const ui = useUI(), latest = useRef({ ui, mouse }); latest.current = { ui, mouse };
  const cursor = useRef({ x: 160, y: 120 });
  const [request, setRequest] = useState<{ id: string; position: { x: number; y: number }; token: number } | null>(null);
  const [gesture] = useState(() => createConfigurationGesture(id => {
    window.dispatchEvent(new CustomEvent("omnium:invoke-button", { detail: id.startsWith("button:") ? id : `button:${id}` }));
  }));
  const token = useRef(0);
  const close = () => { gesture.cancel(); setRequest(null); };
  useLayoutEffect(() => {
    const activate = (event: KeyboardEvent | PointerEvent) => {
      const { ui, mouse } = latest.current;
      if (ui.shortcutCapturing || event.defaultPrevented || !event.shiftKey || event instanceof KeyboardEvent && (event.repeat || isTypingTarget(event.target))) return;
      if (event.target instanceof Element && event.target.closest("omnium-appearance-recovery")) return;
      // Holding Shift must still permit ordinary clicks on the configuration itself.
      if (event instanceof PointerEvent && event.button === 0 && event.target instanceof Element && event.target.closest("[data-context-controller]")) return;
      const chord = event instanceof KeyboardEvent ? normalizeKey(event) : normalizePointer(event);
      const id = configurationTarget(ui.shortcutBindings ?? {}, chord, candidate => featureActionRuntime.available(candidate), { MB4: mouse.backButton, MB5: mouse.forwardButton });
      if (!id) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event instanceof PointerEvent) { cursor.current = { x: event.clientX, y: event.clientY }; recordShortcutPress(event); claimUIPress(event.pointerId, event.pointerType, event.buttons); }
      const action = ACTIONS.find(action => action.id === id.replace(/^button:/, ""));
      // A function may delegate contextual configuration to an existing editor
      // action. This replaces its generic configuration without another key path.
      if (action && "configurationAction" in action) {
        close(); window.dispatchEvent(new CustomEvent("omnium:invoke-button", { detail: `button:${action.configurationAction}` })); return;
      }
      if (gesture.begin(id) === "open") setRequest({ id, position: cursor.current, token: ++token.current });
    };
    const point = (event: PointerEvent) => { cursor.current = { x: event.clientX, y: event.clientY }; };
    const release = (event: KeyboardEvent) => {
      if (event.key !== "Shift") return;
      try { if (!latest.current.ui.shortcutCapturing) gesture.finish(); } finally { close(); }
    };
    const open = (event: Event) => { const { id, position } = (event as CustomEvent).detail; gesture.begin(id, false); setRequest({ id, position: position ?? cursor.current, token: ++token.current }); };
    const tail = (event: MouseEvent) => { if (event.isTrusted && recordedShortcutTail(event)) { event.preventDefault(); event.stopImmediatePropagation(); } };
    window.addEventListener("keydown", activate, true); window.addEventListener("pointerdown", activate, true);
    window.addEventListener("pointermove", point, { passive: true }); window.addEventListener("keyup", release, true);
    window.addEventListener(ACTION_CONFIGURATION_EVENT, open);
    for (const type of ["mousedown", "click", "auxclick", "contextmenu"]) window.addEventListener(type, tail as EventListener, true);
    return () => {
      window.removeEventListener("keydown", activate, true); window.removeEventListener("pointerdown", activate, true);
      window.removeEventListener("pointermove", point); window.removeEventListener("keyup", release, true); window.removeEventListener(ACTION_CONFIGURATION_EVENT, open);
      for (const type of ["mousedown", "click", "auxclick", "contextmenu"]) window.removeEventListener(type, tail as EventListener, true);
    };
  }, []);
  const id = request?.id.replace(/^button:/, ""), fn = ui.functions.find(fn => fn.id === id);
  const spec = ACTIONS.find(action => action.id === id);
  return <ContextualMasterController title={fn?.label ?? spec?.label ?? id ?? "Configuration"} position={request?.position ?? null} onClose={close}>
    {request && <ConfigurationInteractionBoundary id={request.id} gesture={gesture} close={close} key={`${request.id}:${request.token}`}><div className="action-configuration">
      {fn?.configuration ?? <CoupledActionConfiguration id={id ?? request.id} bindings={bindings} />}
    </div></ConfigurationInteractionBoundary>}
  </ContextualMasterController>;
}
