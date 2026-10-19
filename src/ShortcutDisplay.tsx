import {
  ACTIONS,
  defaultSettings,
  type ActionId,
  type WorkspaceSettings,
} from "./workspaceActions";
import { FloatingWindow } from "./ui/FloatingWindow";
import { FunctionControl } from "./ui/UIWorkspace";
export function ShortcutDisplay({
  settings,
  onChange,
  capturing,
  onCapture,
  onClose,
  onInteract,
}: {
  settings: WorkspaceSettings;
  onChange: (settings: WorkspaceSettings) => void;
  capturing: ActionId | null;
  onCapture: (id: ActionId) => void;
  onAction: (id: ActionId) => void;
  onClose: () => void;
  onInteract?: () => void;
}) {
  return (
    <FloatingWindow id="shortcuts" title="Shortcuts & functions" label="Shortcut display" role="complementary" className="shortcut-display" x={window.innerWidth - 430} y={110} width={410} height={Math.min(700, window.innerHeight * .75)} onClose={onClose} closeLabel="Close shortcut display" onInteract={onInteract}>
      <p>Click a function to run it. Click its key to rebind; Esc cancels.</p>
      {Array.from(new Set(ACTIONS.map((a) => a.category))).map((category) => (
        <section key={category}>
          <h3>{category}</h3>
          {ACTIONS.filter((a) => a.category === category).map((a) => (
            <div className="binding-row" key={a.id}>
              <FunctionControl id={a.id} palette />
              <button
                aria-label={`Rebind ${a.label}`}
                title="Click, then press a new shortcut"
                onClick={() => onCapture(a.id)}
              >
                {capturing === a.id ? "Press a key…" : settings.bindings[a.id] || "Unassigned"}
              </button>
              <button
                aria-label={`Clear shortcut ${a.label}`}
                onClick={() =>
                  onChange({ ...settings, bindings: { ...settings.bindings, [a.id]: "" } })
                }
              >
                ×
              </button>
            </div>
          ))}
        </section>
      ))}
      <section>
        <h3>Mouse & gestures</h3>
        <p title="Single-click opens the node options and variants; double-click toggles ordinary contents.">
          Click: options / variants · double-click: expand / collapse
        </p>
        <p>Left-drag node: move · wheel: zoom</p>
        {(
          [
            ["selectionModifier", "Drag selection / click to add"],
            ["nestModifier", "Drag node to nest"],
            ["subtreeModifier", "Click to toggle entire subtree"],
          ] as const
        ).map(([field]) => (
          <FunctionControl key={field} id={`ui:gesture:${field}`} />
        ))}
        {settings.mouse.selectionModifier !== "none" &&
          [settings.mouse.nestModifier, settings.mouse.subtreeModifier].includes(
            settings.mouse.selectionModifier,
          ) && (
            <p role="alert">
              Selection shares a modifier with another gesture and takes priority. Choose different
              modifiers to use both.
            </p>
          )}
        {(
          [
            ["backButton", "MB4"],
            ["forwardButton", "MB5"],
            ["shiftBackButton", "Shift + MB4 (UI Undo)"],
            ["shiftForwardButton", "Shift + MB5 (UI Redo)"],
          ] as const
        ).map(([field]) => (
          <FunctionControl key={field} id={`ui:mouse:${field}`} />
        ))}
        {(["leftEmpty", "rightEmpty"] as const).map((field) => (
          <FunctionControl key={field} id={`ui:camera:${field}`} />
        ))}
      </section>
      <button onClick={() => onChange(defaultSettings())}>
        Restore shortcut and mouse defaults
      </button>
    </FloatingWindow>
  );
}
