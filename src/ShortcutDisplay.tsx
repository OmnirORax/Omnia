import {
  ACTIONS,
  defaultSettings,
  functionShortcutBinding,
  buttonShortcutId,
  type ActionId,
  type WorkspaceSettings,
} from "./workspaceActions";
import {useState} from "react";
import {useUITracked} from "./ui/context";
import {UIField} from "./ui/UIField";
import { FloatingWindow } from "./ui/FloatingWindow";
import { UISection } from "./ui/UISection";
import { FunctionControl } from "./ui/UIWorkspace";
import { FEATURE_GESTURES } from "./featureActions";
export function ShortcutGestures({ category }: { category: string }) {
  return FEATURE_GESTURES.filter(gesture => gesture.category === category).map(gesture =>
    <p key={gesture.id} title={gesture.description}><kbd>{gesture.binding}</kbd> · {gesture.label}</p>);
}
export function ShortcutPicker({id,settings,capturing,onCapture}:{id:string;settings:WorkspaceSettings;capturing:string|null;onCapture:(id:string,label:string)=>void}) {
  const [query,setQuery]=useState(''),[pending,setPending]=useState('');
  const ui=useUITracked(ui=>[ui.functions]);
  const text=query.trim().toLowerCase();
  const matches=text?ui.functions.filter(fn=>!fn.id.startsWith('shortcut:') && !fn.id.startsWith('context:') && !functionShortcutBinding(fn.id,settings.bindings) && `${fn.label} ${fn.id}`.toLowerCase().includes(text)).slice(0,30):[];
  return <div><UIField id={id} label="Find a function to add" category="Shortcuts"><label>Find a function to add<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search functions…" /></label></UIField>
    {text && <div>{matches.length ? matches.map(fn=><button key={fn.id} onClick={()=>{setPending(fn.label);onCapture(buttonShortcutId(fn.id),fn.label);setQuery('');}}>{fn.label}</button>):<small>No unassigned functions found.</small>}</div>}
    {capturing && pending && <p role="status">Press a key or mouse button for {pending}; Esc cancels.</p>}
  </div>;
}
export function ShortcutDisplay({
  settings,
  onChange,
  onCapture,
  capturing,
  onClose,
  onInteract,
}: {
  settings: WorkspaceSettings;
  onChange: (settings: WorkspaceSettings) => void;
  capturing: string | null;
  onCapture: (id: string, label?: string) => void;
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
      <ShortcutPicker id="shortcut-display-search" settings={settings} capturing={capturing} onCapture={onCapture} />
      <p>Click a function to run it. Click its binding, then press a key or mouse button to rebind; Esc cancels. Hover a row for its context.</p>
      {Array.from(new Set(ACTIONS.map((a) => a.category))).map((category) => (
        <UISection legacyTag="SECTION" key={category} id={`shortcuts-${category}`} title={category}>
          {ACTIONS.filter((a) => a.category === category).map((a) => (
            <FunctionControl key={a.id} id={`shortcut:${a.id}`} />
          ))}
          <ShortcutGestures category={category} />
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
          MB4/MB5: undo/redo with configured scope and steps · Composer DOFs and MS: press again to configure. Other functions: hold Shift + shortcut, repeat to cycle, release Shift to execute. Right-click an option locks it; left-click resets to 1.
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
