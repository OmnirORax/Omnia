/** Declare a feature command here once. ACTIONS supplies listing, saved bindings,
 * conflict policy and dispatch; components supply only availability and behavior. */
export const FEATURE_ACTIONS = [
  { id: "omnic.workspace.recover", owner: "omnicLibrary", scope: "global", category: "Omnic library", label: "Recover previous workspace", defaultKey: "", description: "Restore the durable local backup kept before importing or loading a replacement workspace." },
  { id: "omnic.workspace.saveCloud", owner: "omnicWorkspaceCloud", scope: "global", category: "Cloud", label: "Save workspace to cloud", defaultKey: "", description: "Explicit version-checked save of the shared library and all workspace atlases." },
  { id: "omnic.workspace.loadCloud", owner: "omnicWorkspaceCloud", scope: "global", category: "Cloud", label: "Load cloud workspace", defaultKey: "", description: "Replace local workspace with the cloud snapshot, preserving a local recovery copy and shared Undo." },
  { id: "omnic.library.open", owner: "omnicLibrary", scope: "global", category: "Omnic library", label: "Edit object", defaultKey: "", description: "Edit object through the shared workspace library." },
  { id: "omnic.library.place", owner: "omnicLibrary", scope: "global", category: "Omnic library", label: "Place shared object", defaultKey: "", description: "Place shared object through the shared workspace library." },
  { id: "omnic.library.copy", owner: "omnicLibrary", scope: "global", category: "Omnic library", label: "Create independent copy", defaultKey: "", description: "Create independent copy through the shared workspace library." },
  { id: "omnic.workspace.export", owner: "omnicLibrary", scope: "global", category: "Omnic library", label: "Export workspace", defaultKey: "", description: "Export workspace through the shared workspace library." },
  { id: "omnic.workspace.import", owner: "omnicLibrary", scope: "global", category: "Omnic library", label: "Import workspace", defaultKey: "", description: "Import workspace through the shared workspace library." },
  { id: "omnic.library", owner: "omnicWorkspace", scope: "global", category: "Omnic", label: "Omnic library", defaultKey: "", description: "Browse shared objects, structural families, revisions and workspace atlases." },
  { id: "omnic.create", owner: "omnicWorkspace", scope: "global", category: "Omnic", label: "New Omnic object", defaultKey: "", description: "New Omnic object through the shared composer and canonical object state." },
  { id: "omnic.open", owner: "omnicWorkspace", scope: "global", category: "Omnic", label: "Open Omnic composer", defaultKey: "", description: "Open Omnic composer through the shared composer and canonical object state." },
  { id: "omnic.show", owner: "omnicWorkspace", scope: "global", category: "Omnic", label: "Show Omnic structure", defaultKey: "", description: "Show Omnic structure through the shared composer and canonical object state." },
  { id: "omnic.save", owner: "omnicComposer", scope: "global", category: "Omnic", label: "Save shared", defaultKey: "", description: "Save shared Omnic definition through the shared composer and canonical object state." },
  { id: "omnic.copy", owner: "omnicComposer", scope: "global", category: "Omnic", label: "Save copy", defaultKey: "", description: "Save Omnic copy through the shared composer and canonical object state." },
  { id: "omnic.play", owner: "omnicComposer", scope: "global", category: "Omnic", label: "Play / pause", defaultKey: "", description: "Play / pause Omnic motion through the shared composer and canonical object state." },
  { id: "omnic.export", owner: "omnicComposer", scope: "global", category: "Omnic", label: "Export recipe", defaultKey: "", description: "Export Omnic recipe through the shared composer and canonical object state." },
  { id: "omnic.import", owner: "omnicComposer", scope: "global", category: "Omnic", label: "Import recipe", defaultKey: "", description: "Import Omnic recipe through the shared composer and canonical object state." },
  { id: "omnic.reset", owner: "omnicComposer", scope: "global", category: "Omnic", label: "Reset draft", defaultKey: "", description: "Reset Omnic preset through the shared composer and canonical object state." },

  { id: "world.faceSelection", owner: "worldNavigation", scope: "world", category: "World navigation", label: "Frame selected front-on", defaultKey: "", description: "Center and fit selected objects, looking straight at their front plane. Changes camera only; use Back or Undo to restore the previous view." },
  { id: "world.navigate", owner: "worldNavigation", scope: "world", pointerGestureModifiers: ["Ctrl"], gestureSurface: ".spatial-workspace > canvas", category: "World navigation", label: "World navigation", defaultKey: "MB2", description: "Drag using the active movement mode. Hold Ctrl to lock the initial drag axis; Shift opens contextual configuration." },
  { id: "scene.copyPrompt", owner: "scene", scope: "global", category: "Scene", label: "Copy resolved prompt", defaultKey: "", description: "Copy the prompt with active-node values for use in ChatGPT. Remembers this node for the returned image." },
  { id: "scene.chooseImage", owner: "scene", scope: "global", category: "Scene", label: "Choose image", defaultKey: "", description: "Import a PNG, JPEG or WebP, save it in this browser and apply it to the chosen node." },
  { id: "scene.pasteImage", owner: "scene", scope: "global", category: "Scene", label: "Paste image", defaultKey: "", description: "Read an image from the clipboard, save it in this browser and apply it to the chosen node. Choose image works if clipboard access is unavailable." },
  { id: "scene.applyLocal", owner: "scene", scope: "global", category: "Scene", label: "Apply imported image", defaultKey: "", description: "Use the selected local image as this node's saved scene, without generating." },
  { id: "scene.downloadLocal", owner: "scene", scope: "global", category: "Scene", label: "Download image", defaultKey: "", description: "Download the selected original image for backup or transfer to another website address." },
  { id: "scene.deleteLocal", owner: "scene", scope: "global", category: "Scene", label: "Delete imported image", defaultKey: "", description: "Permanently remove this image from browser storage and clear its node assignments. Image deletion cannot be undone." },
  { id: "scene.generate", owner: "scene", scope: "global", category: "Scene", label: "Generate & apply", defaultKey: "", description: "Generate one image from the saved prompt and active node input, store it privately and apply it as the background. Uses paid API credit when configured." },
  { id: "scene.apply", owner: "scene", scope: "global", category: "Scene", label: "Apply saved image", defaultKey: "", description: "Apply a completed image from this workspace without generating or paying again." },
  { id: "scene.clear", owner: "scene", scope: "global", category: "Scene", label: "Clear scene", defaultKey: "", description: "Return to the theme background. Keeps the private image; Undo restores its reference." },
  { id: "scene.refresh", owner: "scene", scope: "global", category: "Scene", label: "Refresh scene status", defaultKey: "", description: "Reload saved generation attempts without submitting a paid request." },
  { id: "backend.signIn", owner: "backend", scope: "global", category: "Cloud", label: "Sign in to cloud", defaultKey: "", description: "Sign in with an existing account. Local atlas data is not uploaded." },
  { id: "backend.signOut", owner: "backend", scope: "global", category: "Cloud", label: "Sign out of cloud", defaultKey: "", description: "Sign out in this browser and clear the cloud panel. Keeps the local atlas." },
  { id: "backend.refresh", owner: "backend", scope: "global", category: "Cloud", label: "Refresh cloud files", defaultKey: "", description: "Reload authorized workspaces and files." },
  { id: "backend.createWorkspace", owner: "backend", scope: "global", category: "Cloud", label: "Create private workspace", defaultKey: "", description: "Create a private cloud workspace. Does not upload the current atlas." },
  { id: "backend.upload", owner: "backend", scope: "global", category: "Cloud", label: "Upload private image", defaultKey: "", description: "Store a PNG, JPEG or WebP image in the selected workspace." },
  { id: "backend.download", owner: "backend", scope: "global", category: "Cloud", label: "Download selected cloud file", defaultKey: "", description: "Download a ready file using your current permissions." },
  { id: "backend.finalize", owner: "backend", scope: "global", category: "Cloud", label: "Finish pending upload", defaultKey: "", description: "Validate a previously uploaded pending image. Missing uploads can be deleted." },
  { id: "backend.delete", owner: "backend", scope: "global", category: "Cloud", label: "Delete selected cloud file", defaultKey: "", description: "Delete the selected cloud file. Failed deletions can be retried." },
  { id: "history.configure", owner: "historyController", scope: "global", category: "History", label: "Configure undo / redo", defaultKey: "", description: "Hold Shift and press your Undo/Redo mouse binding. Repeat or scroll to choose scope; release Shift to execute. Right-click an option applies and locks; left-click resets to 1. Shows only contextual history controls in Master Controller." },
  { id: "context.resize", owner: "frameResize", scope: "uiContext", category: "Active context", label: "Resize / restore active frame", defaultKey: "W", description: "Resize the active frame to the configured surrounding-edge level, or restore it. Shift opens its adaptive configuration; hover a level to preview." },
  { id: "context.back", owner: "activeContext", scope: "uiContext", allowBlocked: true, category: "Active context", label: "Step back / minimize active context", defaultKey: "Esc", allowTyping: true, description: "Leave one value field or popup level; minimize the active frame at frame level. Pending appearance choices remain protected." },
  { id: "context.search", owner: "searchController", scope: "uiContext", allowBlocked: true, category: "Active context", label: "Search", defaultKey: "S", description: "Search with the retained scope. Shift configures active frame, parent frames or all UI; repeat to cycle and release Shift to search." },
  { id: "context.float", owner: "activeContext", scope: "uiContext", category: "Active context", label: "Float active frame", defaultKey: "", description: "Detach the active frame or native panel into a floating window, preserving its contents and shared UI history." },
  { id: "properties.copy", owner: "propertyClipboard", scope: "uiContext", category: "Properties", label: "Copy properties", defaultKey: "", description: "Choose which resolved properties to copy from the current editing scope. All available properties start selected; mixed values are omitted." },
  { id: "properties.paste", owner: "propertyClipboard", scope: "uiContext", category: "Properties", label: "Paste applicable properties", defaultKey: "", description: "Paste copied values into the current editing scope through shared setters, skipping unsupported, locked or bypassed properties." },
  { id: "context.close", owner: "activeContext", scope: "uiContext", allowBlocked: true, category: "Active context", label: "Close active context", defaultKey: "X", description: "Close the active frame or popup through its shared close action. Does not close a browser tab or intercept typed text." },
  { id: "context.minimize", owner: "activeContext", scope: "uiContext", allowBlocked: true, category: "Active context", label: "Minimize / maximize active frame", defaultKey: "M", description: "Toggle the active frame between minimized and expanded, respecting pending appearance changes." },
  { id: "context.descendants", owner: "activeContext", scope: "uiContext", allowBlocked: true, category: "Active context", label: "Expand / collapse active descendants", defaultKey: "D", description: "Use the active frame's shared descendant expansion action." },
  { id: "selector.open", owner: "visualSelector", scope: "global", category: "Visual selector", label: "⦲ Toggle visual selector controller", defaultKey: "Q", configurationAction: "selector.edit", description: "Open selector geometry controls at the pointer; press again to resume selection. Shift opens the selected-property Master Controller instead." },
  { id: "selector.lock", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Lock / unlock MS cursor", defaultKey: "Ctrl+MB3", description: "Park MS at its current position and use the normal cursor. Press again to resume MS control; preserves selection and settings." },
  { id: "selector.selfInventory", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle Self inventory", defaultKey: "", description: "Select logical meta targets such as Mouse or Selector feedback; their existing coupled properties appear in Master controller." },
  { id: "selector.selectMouse", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle Mouse selection", defaultKey: "", description: "Select or deselect the logical mouse target; Master controller shows its coupled properties, including Mouse trail, while selected." },
  { id: "selector.pattern", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Cycle selection geometry / pattern", defaultKey: "E", description: "While configuring or aiming the visual selector. Takes priority over node expansion." },
  { id: "selector.feedbackView", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle Selection / Preview", defaultKey: "", description: "Hide or restore selection feedback without changing selected targets or their properties." },
  { id: "selector.deselect", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Deselect pointed pattern / all", defaultKey: "MB2", description: "While aiming: remove the selected pattern under the pointer using the current geometry/pattern rules. If the pointed target is not selected, clear the entire selection. Never adds targets." },
  { id: "selector.edit", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Edit selected appearance", defaultKey: "", description: "Shift + the selector shortcut (Shift+Q by default) opens selected-property editing; logical objects reveal Master Controller." },
  { id: "selector.cancel", owner: "visualSelector", scope: "visualSelector", allowBlocked: true, category: "Visual selector", label: "Disable selector and clear selection", defaultKey: "Esc", description: "While the selector or its accepted selection is active. Takes priority over active-window Escape handling.", allowTyping: true },
  { id: "selector.undo", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Undo visual selection", defaultKey: "Ctrl+Z", description: "While configuring or aiming; uses selection history, not graph/UI history." },
  { id: "selector.redo", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Redo visual selection", defaultKey: "Ctrl+Y", description: "While configuring or aiming; uses selection history." },
  { id: "selector.redoAlternate", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Redo visual selection (alternate)", defaultKey: "", description: "An independently assignable alternate binding for selection redo." },
  { id: "selector.clear", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Clear visual selection", defaultKey: "", description: "Clear accepted parts and boundary without disabling the selector." },
  { id: "selector.aim", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Aim visual selector", defaultKey: "", description: "Leave configuration / editing and resume picking." },
  { id: "selector.backgrounds", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle BG / empty space detection", defaultKey: "", description: "Include backgrounds / empty space in new selection picks. Off by default; preserves existing selections." },
  { id: "selector.boundary", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle 🞅 Frame / intersections", defaultKey: "", description: "Choose the path itself independently of inside/outside and geometry mode." },
  { id: "selector.inside", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle ◉ In-frame inclusion", defaultKey: "", description: "Independent of Outside; both or neither may be active." },
  { id: "selector.outside", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle ⏺ Outside frame inclusion", defaultKey: "", description: "Independent of Inside; both or neither may be active." },
  { id: "selector.include", owner: "visualSelector", scope: "visualSelector", category: "Visual selector", label: "Toggle pointed pattern / define geometry", defaultKey: "MB1", pointerGestureModifiers: ["Ctrl"], description: "Click toggles included/unselected, with optional Ctrl. Geometry starts with the circle baseline; neutral frames permit selective exceptions." },
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
    available(id: string) { return [...(handlers.get(id)?.values() ?? [])].some(handler => handler.enabled()); },
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
  { id: "world.axisLock", category: "World navigation", binding: "Ctrl + configured navigation drag", label: "Hold initial rotation axis", description: "First clear drag chooses horizontal or vertical motion and freezes the rotation axis until Ctrl is released. Orthogonal pointer jitter is ignored; no pivot or target change." },
  { id: "function.configure", category: "Master controller", binding: "Hold Shift + any configured shortcut; release Shift", label: "Configure that function", description: "Universal configuration modifier. Opens only that function’s adaptive controls. Repeat the shortcut to cycle; release Shift to execute once. Right-click an option applies and locks its default; left-click resets to priority 1. Applies to keyboard and mouse shortcuts, present and future." },
  { id: "selector.pick", category: "Visual selector", binding: "Left click / drag", label: "Define geometry or toggle matching patterns", description: "One rebindable selection command. Unselected patterns become included; fully included patterns become unselected. Drag defines geometry; polygon vertices finish with Enter or its first vertex." },
  { id: "selector.rotate", category: "Visual selector", binding: "Shift+Wheel / Ctrl+Shift+Wheel", label: "Rotate geometry finely / 10× faster", description: "Rotate the active axis/shape before placement or placed geometry while refining. Lines keep their defined origin fixed. Ctrl accelerates rotation 10×; ordinary wheel remains scrolling/zooming." },
  { id: "selector.depth", category: "Visual selector", binding: "Wheel", label: "Change pointed owner depth", description: "Before placing pointed geometry: choose its containing owner." },
  { id: "selector.context", category: "Visual selector", binding: contextMenuBinding, label: "Edit accepted visual selection", description: "Platform context-menu gesture, independent of the assigned edit shortcut." },
  { id: "ui.context", category: "UI editing", binding: contextMenuBinding, label: "Open focused control's context action", description: "Native context-menu keyboard gesture; appearance circles bypass/reconnect their saved styling." },
  { id: "ui.rename", category: "UI editing", binding: "F2", label: "Rename focused UI label", description: "When a renameable UI label has keyboard focus." },
] as const;
