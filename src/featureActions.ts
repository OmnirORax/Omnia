/** Declare a feature command here once. ACTIONS supplies listing, saved bindings,
 * conflict policy and dispatch; components supply only availability and behavior. */
export const FEATURE_ACTIONS = [
  { id: "appearance.greenElectricText", owner: "masterController", scope: "global", category: "Master controller", label: "Apply green text lightning", defaultKey: "", description: "Apply a green electric-text recipe to UI lettering through the shared appearance draft. Keeps typography and non-text appearance; respects locks and bypass." },
  { id: "selector.open", owner: "visualSelector", scope: "global", category: "Visual selector", label: "⦲ Toggle visual selector controller", defaultKey: "MB3", description: "Open configuration at the pointer; press again to resume selection. Preserves selection and configuration." },
  { id: "selector.selfInventory", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle Self inventory", defaultKey: "", description: "Select logical meta targets such as Mouse or Selector feedback; their existing coupled properties appear in Master controller." },
  { id: "selector.selectMouse", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle Mouse selection", defaultKey: "", description: "Select or deselect the logical mouse target; Master controller shows its coupled properties, including Mouse trail, while selected." },
  { id: "selector.pattern", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Cycle selection geometry / pattern", defaultKey: "E", description: "While configuring or aiming the visual selector. Takes priority over node expansion." },
  { id: "selector.feedbackView", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle Selection / Preview", defaultKey: "", description: "Hide or restore selection feedback without changing selected targets or their properties." },
  { id: "selector.edit", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Edit selected appearance", defaultKey: "MB2", description: "Requires accepted parts, a boundary or a logical object. Opens shared editing; logical objects reveal Master controller." },
  { id: "selector.cancel", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Disable selector and clear selection", defaultKey: "Esc", description: "While the selector or its accepted selection is active.", allowTyping: true },
  { id: "selector.undo", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Undo visual selection", defaultKey: "Ctrl+Z", description: "While configuring or aiming; uses selection history, not graph/UI history." },
  { id: "selector.redo", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Redo visual selection", defaultKey: "Ctrl+Shift+Z", description: "While configuring or aiming; uses selection history." },
  { id: "selector.redoAlternate", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Redo visual selection (alternate)", defaultKey: "Ctrl+Y", description: "An independently assignable alternate binding for selection redo." },
  { id: "selector.clear", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Clear visual selection", defaultKey: "", description: "Clear accepted parts and boundary without disabling the selector." },
  { id: "selector.aim", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Aim visual selector", defaultKey: "", description: "Leave configuration / editing and resume picking." },
  { id: "selector.backgrounds", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle BG / empty space detection", defaultKey: "", description: "Include backgrounds / empty space in new selection picks and previews. Off by default; preserves existing selections." },
  { id: "selector.boundary", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle 🞅 Frame / intersections", defaultKey: "", description: "Choose the path itself independently of inside/outside and geometry mode." },
  { id: "selector.inside", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle ◉ In-frame inclusion", defaultKey: "", description: "Independent of Outside; both or neither may be active." },
  { id: "selector.outside", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle ⏺ Outside frame inclusion", defaultKey: "", description: "Independent of Inside; both or neither may be active." },
  { id: "selector.include", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle pointed pattern / define geometry", defaultKey: "MB1", pointerGestureModifiers: ["Ctrl"], description: "Click toggles included/unselected, including while holding Ctrl for preview. Geometry starts with the circle baseline; neutral frames permit selective exceptions." },
  { id: "selector.finishGeometry", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Finish polygon selection geometry", defaultKey: "Enter", description: "Commit a polygon with three or more vertices; closing on its first vertex also finishes." },
  { id: "selector.releaseGeometry", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Release working geometry", defaultKey: "", description: "Retain accepted selection rules and return to matching patterns across the app." },
  { id: "selector.closePath", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle closed freehand geometry", defaultKey: "", description: "Closed paths support inside/outside as well as intersections; open paths use intersections." },
  { id: "selector.bounds", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle finite selection line bounds", defaultKey: "", description: "While using an axis or direction; position segments are always finite." },
  { id: "selector.colorStop", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle stopping selection at color change", defaultKey: "", description: "While using an axis, direction or position. Sample a painted part to start." },
] as const;
export type FeatureActionId = (typeof FEATURE_ACTIONS)[number]["id"];
export type FeatureOwner = (typeof FEATURE_ACTIONS)[number]["owner"];
export type FeatureActionFor<Owner extends FeatureOwner> = Extract<(typeof FEATURE_ACTIONS)[number], { owner: Owner }>["id"];
export type ActionInput = KeyboardEvent | MouseEvent | undefined;
export type ActionHandler = { enabled: () => boolean; run: (input: ActionInput) => void };

/** Runtime callbacks are not another command inventory. Unknown IDs are rejected,
 * and unmounting a feature removes its behavior without deleting its catalog row. */
export function createFeatureActionRuntime(ids: readonly string[] = FEATURE_ACTIONS.map(action => action.id)) {
  const known = new Set(ids), handlers = new Map<string, Map<symbol, ActionHandler>>();
  return {
    register(id: string, handler: ActionHandler) {
      if (!known.has(id)) throw new Error(`Register shortcut metadata before installing its handler: ${id}`);
      const token = Symbol(id), entries = handlers.get(id) ?? new Map<symbol, ActionHandler>();
      entries.set(token, handler); handlers.set(id, entries);
      return () => { entries.delete(token); if (!entries.size) handlers.delete(id); };
    },
    invoke(id: string, input?: ActionInput): boolean {
      const handler = [...(handlers.get(id)?.values() ?? [])].reverse().find(handler => handler.enabled());
      if (!handler) return false;
      handler.run(input); return true;
    },
  };
}
export const featureActionRuntime = createFeatureActionRuntime();

// Recording a pointer binding must not execute it through the trailing native
// click/contextmenu after React has already left capture mode.
let recordedPress: { button: number; timeStamp: number } | null = null;
export const clearRecordedShortcutPress = () => { recordedPress = null; };
export const recordShortcutPress = (event: Pick<MouseEvent, "button" | "timeStamp">) => { recordedPress = { button: event.button, timeStamp: event.timeStamp }; };
export const recordedShortcutTail = (event: Pick<MouseEvent, "button" | "timeStamp" | "type">) => !!recordedPress &&
  event.type !== "pointerdown" && event.button === recordedPress.button && event.timeStamp >= recordedPress.timeStamp && event.timeStamp - recordedPress.timeStamp < 1500;

/** Native gestures are listed with commands but keep their renderer's gesture
 * lifecycle. Ordinary widget Enter/Escape/arrow navigation remains native. */
const CONTEXT_MENU_KEYS = [{ key: "ContextMenu", shift: false }, { key: "F10", shift: true }] as const;
const contextMenuBinding = "Context-menu key / Shift+F10";
export const RECOVERY_GESTURE = { id: "appearance.recovery", category: "Workspace", key: "Escape", holdMs: 2000,
  binding: "Hold Esc for 2 seconds", label: "Open protected appearance recovery", description: "Always available, including while editing text or using the selector; this recovery gesture is fixed." } as const;
export const nativeContextMenuKey = (event: Pick<KeyboardEvent, "key" | "shiftKey" | "ctrlKey" | "metaKey" | "altKey">) =>
  !event.ctrlKey && !event.metaKey && !event.altKey && CONTEXT_MENU_KEYS.some(binding => binding.key === event.key && binding.shift === event.shiftKey);
export const FEATURE_GESTURES = [
  RECOVERY_GESTURE,
  { id: "selector.pick", category: "Visual selector", binding: "Left click / drag", label: "Define geometry or toggle matching patterns", description: "One rebindable selection command. Unselected patterns become included; fully included patterns become unselected. Drag defines geometry; polygon vertices finish with Enter or its first vertex." },
  { id: "selector.preview", category: "Visual selector", binding: "Hold Ctrl", label: "Preview the next selection toggle", description: "Before any selection or boundary, previews are automatic. Afterwards hold Ctrl: additions preview green, included patterns temporarily lose green. The selection click still works while Ctrl is held." },
  { id: "selector.rotate", category: "Visual selector", binding: "Shift+Wheel / Ctrl+Shift+Wheel", label: "Rotate geometry finely / 10× faster", description: "Rotate the active axis/shape before placement or placed geometry while refining. Lines keep their defined origin fixed. Ctrl accelerates rotation 10×; ordinary wheel remains scrolling/zooming." },
  { id: "selector.depth", category: "Visual selector", binding: "Wheel", label: "Change pointed owner depth", description: "Before placing pointed geometry: choose its containing owner." },
  { id: "selector.context", category: "Visual selector", binding: contextMenuBinding, label: "Edit accepted visual selection", description: "Platform context-menu gesture, independent of the assigned edit shortcut." },
  { id: "ui.context", category: "UI editing", binding: contextMenuBinding, label: "Open focused control's context action", description: "Native context-menu keyboard gesture; appearance circles bypass/reconnect their saved styling." },
  { id: "ui.rename", category: "UI editing", binding: "F2", label: "Rename focused UI label", description: "When a renameable UI label has keyboard focus." },
] as const;
