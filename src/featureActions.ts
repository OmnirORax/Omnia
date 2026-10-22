/** Declare a feature command here once. ACTIONS supplies listing, saved bindings,
 * conflict policy and dispatch; components supply only availability and behavior. */
export const FEATURE_ACTIONS = [
  { id: "selector.open", owner: "visualSelector", scope: "global", category: "Visual selector", label: "⦲ Toggle visual selector controller", defaultKey: "MB3", description: "Open configuration at the pointer; press again to resume selection. Preserves selection and configuration." },
  { id: "selector.selectMouse", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Select Mouse for inspection", defaultKey: "", description: "Select the logical mouse target; Master controller shows its coupled properties, including Mouse trail." },
  { id: "selector.pattern", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Cycle selection pattern / axis / direction / position", defaultKey: "E", description: "While configuring or aiming the visual selector. Takes priority over node expansion." },
  { id: "selector.edit", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Edit selected appearance", defaultKey: "MB2", description: "Requires accepted parts, a boundary or a logical object. Opens shared editing; logical objects reveal Master controller." },
  { id: "selector.cancel", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Disable selector and clear selection", defaultKey: "Esc", description: "While the selector or its accepted selection is active.", allowTyping: true },
  { id: "selector.undo", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Undo visual selection", defaultKey: "Ctrl+Z", description: "While configuring or aiming; uses selection history, not graph/UI history." },
  { id: "selector.redo", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Redo visual selection", defaultKey: "Ctrl+Shift+Z", description: "While configuring or aiming; uses selection history." },
  { id: "selector.redoAlternate", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Redo visual selection (alternate)", defaultKey: "Ctrl+Y", description: "An independently assignable alternate binding for selection redo." },
  { id: "selector.clear", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Clear visual selection", defaultKey: "", description: "Clear accepted parts and boundary without disabling the selector." },
  { id: "selector.aim", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Aim visual selector", defaultKey: "", description: "Leave configuration / editing and resume picking." },
  { id: "selector.boundary", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle selector boundary O", defaultKey: "", description: "Boundary mode stays on until toggled off." },
  { id: "selector.inside", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle selection inside boundary", defaultKey: "", description: "Independent of Outside; both or neither may be active." },
  { id: "selector.outside", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle selection outside boundary", defaultKey: "", description: "Independent of Inside; both or neither may be active." },
  { id: "selector.include", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Arm include visual parts", defaultKey: "", description: "Toggle Include / neutral without changing accepted selection." },
  { id: "selector.exclude", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Arm exclude visual parts", defaultKey: "", description: "Toggle Exclude / neutral without changing accepted selection." },
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
  { id: "selector.pick", category: "Visual selector", binding: "Left click / drag", label: "Pick a boundary, part or line", description: "While aiming. Drag previews; release accepts one operation." },
  { id: "selector.depth", category: "Visual selector", binding: "Wheel", label: "Change candidate boundary depth", description: "While aiming with O active; Inside/Outside bounds still apply." },
  { id: "selector.context", category: "Visual selector", binding: contextMenuBinding, label: "Edit accepted visual selection", description: "Platform context-menu gesture, independent of the assigned edit shortcut." },
  { id: "ui.context", category: "UI editing", binding: contextMenuBinding, label: "Open focused control's context action", description: "Native context-menu keyboard gesture; appearance circles bypass/reconnect their saved styling." },
  { id: "ui.rename", category: "UI editing", binding: "F2", label: "Rename focused UI label", description: "When a renameable UI label has keyboard focus." },
] as const;
