import {
  ACTIONS,
  defaultSettings,
  type ActionId,
  type WorkspaceSettings,
} from "./workspaceActions";
import { FloatingWindow } from "./ui/FloatingWindow";
import { UISection } from "./ui/UISection";
import { FunctionControl } from "./ui/UIWorkspace";
export function ShortcutDisplay({
  settings,
  onChange,
  onClose,
  onInteract,
}: {
  settings: WorkspaceSettings;
  onChange: (settings: WorkspaceSettings) => void;
  capturing: string | null;
  onCapture: (id: ActionId) => void;
  onAction: (id: ActionId) => void;
  onClose: () => void;
  onInteract?: () => void;
}) {
  return (
    <FloatingWindow
      id="shortcuts"
      title="Shortcuts & functions"
      label="Shortcut display"
      role="complementary"
      className="shortcut-display"
      x={window.innerWidth - 430}
      y={110}
      width={410}
      height={Math.min(700, window.innerHeight * 0.75)}
      onClose={onClose}
      closeLabel="Close shortcut display"
      onInteract={onInteract}
    >
      <p>Click a function to run it. Click its key to rebind; Esc cancels.</p>
      {Array.from(new Set(ACTIONS.map((a) => a.category))).map((category) => (
        <UISection legacyTag="SECTION" key={category} id={`shortcuts-${category}`} title={category}>
          {ACTIONS.filter((a) => a.category === category).map((a) => (
            <FunctionControl key={a.id} id={`shortcut:${a.id}`} />
          ))}
        </UISection>
      ))}
      {Object.keys(settings.bindings).some(id => id.startsWith("button:")) && <UISection legacyTag="SECTION" id="button-shortcuts" title="Button shortcuts">
        {Object.keys(settings.bindings).filter(id => id.startsWith("button:")).map(id => <FunctionControl key={id} id={`shortcut:${id}`} />)}
      </UISection>}
      <UISection legacyTag="SECTION" id="mouse-gestures" title="Mouse & gestures">
        <p title="Single-click opens the node options and variants; double-click toggles ordinary contents.">
          Click: options / variants · double-click: expand / collapse
        </p>
        <p>Left-drag node: move · wheel: zoom</p>
        <p>Arrow keys: move the selected node in the view plane, one snap step (0.2 units with snapping off). Hold to repeat.</p>
        <p>
          MB4/MB5: graph undo/redo · Shift: UI history · Alt: five steps (combine Shift+Alt for UI).
        </p>
        <p>
          Ctrl/Cmd-click UI buttons to select them, or use Select UI buttons and drag a box. Drag
          the selection together; Compact selected UI closes gaps.
        </p>
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
      </UISection>
      <button onClick={() => onChange({ ...settings, bindings: defaultSettings().bindings, buttonLabels: {}, mouse: defaultSettings().mouse })}>
        Restore shortcut and mouse defaults
      </button>
    </FloatingWindow>
  );
}
