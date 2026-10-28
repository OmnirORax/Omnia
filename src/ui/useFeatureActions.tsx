import { useLayoutEffect, useRef, type ReactNode } from "react";
import { FEATURE_ACTIONS, featureActionRuntime, recordedShortcutTail, type ActionInput, type FeatureActionFor, type FeatureOwner } from "../featureActions.ts";
import { isTypingTarget, preferredFeatureKey, matchesPointerShortcut, normalizeKey, shortcutBinding } from "../workspaceActions.ts";
import { useUI, useUITracked } from "./context";

type Handlers<Owner extends FeatureOwner> = Record<FeatureActionFor<Owner>, { enabled: boolean; run: (input: ActionInput) => void; configuration?: ReactNode }>;
/** A feature cannot install a binding absent from the shared catalog. Its command
 * buttons, runtime input and shortcut rows all use these same registered IDs. */
export function useFeatureActions<Owner extends FeatureOwner>(owner: Owner, handlers: Handlers<Owner>) {
  const ui = useUITracked(ui=>[ui.registerFunction]), latest = useRef({ ui, handlers }); latest.current = { ui, handlers };
  const definitions = FEATURE_ACTIONS.filter(action => action.owner === owner).sort((a, b) => Number(a.scope === "global") - Number(b.scope === "global"));
  const configurations = JSON.stringify(definitions.map(action => handlers[action.id as FeatureActionFor<Owner>].configuration !== undefined));
  const availability = JSON.stringify(definitions.map(action => handlers[action.id as FeatureActionFor<Owner>].enabled));
  useLayoutEffect(() => {
    const cleanups = definitions.flatMap(action => {
      const id = action.id as FeatureActionFor<Owner>;
      return [featureActionRuntime.register(id, { enabled: () => latest.current.handlers[id].enabled, run: input => latest.current.handlers[id].run(input) }),
        ui.registerFunction({ id, label: action.label, category: action.category, configuration: handlers[id].configuration === undefined ? undefined : <ConfigurationContent render={() => latest.current.handlers[id].configuration} />, available: handlers[id].enabled,
          element: <button type="button" disabled={!handlers[id].enabled} title={action.description}
            onClick={() => featureActionRuntime.invoke(id)}>{action.label}</button> })];
    });
    return () => { for (const cleanup of cleanups.reverse()) cleanup(); };
  }, [owner, ui.registerFunction, availability, configurations]);
  const api = useRef({
    blocked: () => !!latest.current.ui.shortcutCapturing || !!latest.current.ui.shortcutsBlocked,
    binding: (id: FeatureActionFor<Owner>) => shortcutBinding(id, latest.current.ui.shortcutBindings ?? {}),
    matches: (id: FeatureActionFor<Owner>, event: KeyboardEvent | MouseEvent, gestureModifiers = true) => {
      const current = latest.current;
      const definition = FEATURE_ACTIONS.find(action => action.id === id)!;
      if ("gestureSurface" in definition && event instanceof MouseEvent && (!(event.target instanceof Element) || !event.target.closest(definition.gestureSurface))) return false;
      if (current.ui.shortcutCapturing || current.ui.shortcutsBlocked && !("allowBlocked" in definition && definition.allowBlocked) || event.defaultPrevented || !current.handlers[id].enabled) return false;
      if (event instanceof MouseEvent && recordedShortcutTail(event)) return false;
      if (event instanceof KeyboardEvent && (event.repeat || isTypingTarget(event.target) && !("allowTyping" in definition && definition.allowTyping))) return false;
      return event instanceof KeyboardEvent
        ? preferredFeatureKey(current.ui.shortcutBindings ?? {}, normalizeKey(event), candidate => featureActionRuntime.available(candidate), isTypingTarget(event.target), !!current.ui.shortcutsBlocked) === id
        : matchesPointerShortcut(id, current.ui.shortcutBindings ?? {}, event, gestureModifiers);
    },
    invoke: (id: FeatureActionFor<Owner>, input?: ActionInput) => featureActionRuntime.invoke(id, input),
    available: (id:FeatureActionFor<Owner>) => latest.current.handlers[id].enabled,
    handle: (event: KeyboardEvent | MouseEvent, accepts: (id: FeatureActionFor<Owner>) => boolean = () => true) => {
      // Explicit modified commands take priority over gesture-transparent matches.
      for (const gestureModifiers of [false, true]) for (const definition of definitions) {
        const id = definition.id as FeatureActionFor<Owner>;
        if (accepts(id) && api.current.matches(id, event, gestureModifiers)) return api.current.invoke(id, event);
      }
      return false;
    },
  });
  return api.current;
}

function ConfigurationContent({ render }: { render: () => ReactNode }) { useUI(); return render(); }
