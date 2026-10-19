import {
  ACTIONS,
  defaultSettings,
  type ActionId,
  type WorkspaceSettings,
  type SubtreeModifier,
} from "./workspaceActions";
export function ShortcutDisplay({
  settings,
  onChange,
  capturing,
  onCapture,
  onAction,
  onClose,
}: {
  settings: WorkspaceSettings;
  onChange: (settings: WorkspaceSettings) => void;
  capturing: ActionId | null;
  onCapture: (id: ActionId) => void;
  onAction: (id: ActionId) => void;
  onClose: () => void;
}) {
  return (
    <aside className="shortcut-display" aria-label="Shortcut display">
      <div className="shortcut-heading">
        <strong>Shortcuts & functions</strong>
        <button onClick={onClose} aria-label="Close shortcut display">
          ×
        </button>
      </div>
      <p>Click a function to run it. Click its key to rebind; Esc cancels.</p>
      {Array.from(new Set(ACTIONS.map((a) => a.category))).map((category) => (
        <section key={category}>
          <h3>{category}</h3>
          {ACTIONS.filter((a) => a.category === category).map((a) => (
            <div className="binding-row" key={a.id}>
              <button title={a.label} onClick={() => onAction(a.id)}>
                {a.label}
              </button>
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
        ).map(([field, label]) => (
          <label key={field}>
            {label}
            <select
              aria-label={label}
              value={settings.mouse[field]}
              onChange={(e) =>
                onChange({
                  ...settings,
                  mouse: { ...settings.mouse, [field]: e.target.value as SubtreeModifier },
                })
              }
            >
              {["ctrl", "shift", "alt", "none"].map((m) => (
                <option key={m} value={m}>
                  {m === "ctrl" ? "Ctrl / Cmd" : m}
                </option>
              ))}
            </select>
          </label>
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
          ] as const
        ).map(([field, label]) => (
          <label key={field}>
            {label}
            <select
              aria-label={`${label} action`}
              value={settings.mouse[field]}
              onChange={(e) =>
                onChange({
                  ...settings,
                  mouse: { ...settings.mouse, [field]: e.target.value as ActionId },
                })
              }
            >
              {ACTIONS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        {(["leftEmpty", "rightEmpty"] as const).map((field) => (
          <label key={field}>
            {field === "leftEmpty" ? "Left-drag empty space" : "Right-drag empty space"}
            <select
              aria-label={`Shortcut ${field}`}
              value={settings.mouse[field]}
              onChange={(e) =>
                onChange({
                  ...settings,
                  mouse: {
                    ...settings.mouse,
                    [field]: e.target.value as "pan" | "rotate" | "none",
                  },
                })
              }
            >
              {["pan", "rotate", "none"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        ))}
      </section>
      <button onClick={() => onChange(defaultSettings())}>
        Restore shortcut and mouse defaults
      </button>
    </aside>
  );
}
