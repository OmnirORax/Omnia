import { useEffect, useState } from "react";
import { FloatingWindow } from "./FloatingWindow";
import { useUI } from "./context";
import { UISection } from "./UISection";
import { UIField } from "./UIField";
import { UIAction } from "./UIAction";
import { FunctionControl } from "./UIWorkspace";
import { getContainer, dockResident, floatResident, residentContextScope, ownerOf, updateContainer } from "./layout";
import { cursorPosition } from "./cursorPosition";
import { addCustomControl, customControl } from "./authoring";
import { CUSTOM_CONTROL_KINDS, type CustomControlKind } from "./controlDefinitions";
import { startResidentDrag } from "./drag";
import { unregisteredUIParts, type UnregisteredUIPart } from "./coverage";
import { nameFor } from "./FrameSearch";

/** Author with the existing frame/field registry, not a second layout engine. */
export function UIEditor() {
  const ui = useUI(), open = !!ui.layout.panels["@devMode"];
  const [query, setQuery] = useState(""), [chosen, setChosen] = useState(""), [destination, setDestination] = useState("");
  const [name, setName] = useState("New field"), [kind, setKind] = useState<CustomControlKind>("text"), [options, setOptions] = useState("Option 1\nOption 2"), [notice, setNotice] = useState("");
  useEffect(() => {
    document.documentElement.toggleAttribute("data-ui-edit-mode", open);
    return () => document.documentElement.removeAttribute("data-ui-edit-mode");
  }, [open]);
  const [unregistered, setUnregistered] = useState<UnregisteredUIPart[]>([]);
  const close = () => ui.update(layout => ({ ...layout, panels: { ...layout.panels, "@devMode": false } }));
  const effective = { ...ui.layout, windows: { ...Object.fromEntries(ui.defaults), ...ui.layout.windows } };
  const frames = [...ui.frameActions.entries()].filter(([key]) => {
    if (residentContextScope(effective, key) || key === "window:ui-editor") return false;
    const seen = new Set<string>();
    for (let parent: string | undefined = key; parent && !seen.has(parent); parent = ownerOf(effective, parent)) {
      if (parent === "window:ui-editor" || parent === "window:function-appearance") return false;
      seen.add(parent);
    }
    return true;
  });
  const controls = ui.functions.filter(fn => !fn.scope && !fn.id.startsWith("ui:editor:") && `${fn.label} ${fn.category ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const placement = () => {
    const point = cursorPosition(), panel = document.querySelector<HTMLElement>('[data-ui-resident-root="window:ui-editor"]')?.getBoundingClientRect();
    const x = panel && point.x >= panel.left && point.x <= panel.right
      ? panel.right + 220 < innerWidth ? panel.right + 12 : Math.max(8, panel.left - 220)
      : point.x + 20;
    return { x: Math.max(8, Math.min(x, innerWidth - 220)), y: Math.max(8, Math.min(point.y, innerHeight - 120)) };
  };
  const place = (id: string) => {
    try {
      ui.update(layout => {
        let next = { ...layout, windows: { ...Object.fromEntries(ui.defaults), ...layout.windows } };
        if (destination && getContainer(next, destination)) {
          next = updateContainer(next, destination, { collapsed: false, closed: false });
          return dockResident(next, `function:${id}`, destination, getContainer(next, destination)?.members?.length ?? 0);
        }
        const point = placement();
        return floatResident(next, `function:${id}`, point.x, point.y);
      });
      setNotice("Control placed. Drag its edge to move it; right-click to rename or customize.");
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
  };
  if (!open) return null;
  return <FloatingWindow id="ui-editor" title="UI edit mode" width={450} height={670} onClose={close}>
    <p>Drag frame bars or field edges. Ctrl/Cmd-click selects items; Shift-click selects a range. Right-click to rename, style or close. Shift+MB4/MB5 undo and redo UI changes.</p>
    <UISection id="edit-tools" title="Arrange & recover">
      <div className="ui-editor-tools">{["ui:select", "ui:compact", "ui:align", "ui:createFrame", "ui:arrange", "ui:undo", "ui:redo", "ui:saveTemplate", "ui:loadTemplate", "ui:reset"].map(id => <FunctionControl key={id} id={id} />)}</div>
    </UISection>
    <UISection id="existing-controls" title="Add existing controls">
      <UIField id="ui:editor:findControl" label="Find a UI control" category="Interface"><label>Find control<input aria-label="Find a UI control" type="search" value={query} onChange={e => setQuery(e.target.value)} /></label></UIField>
      <UIField id="ui:editor:chosenControl" label="UI control to place" category="Interface"><label>Control<select aria-label="UI control to place" value={chosen} onChange={e => setChosen(e.target.value)}>
        <option value="">Choose a control…</option>{controls.map(fn => <option key={fn.id} value={fn.id}>{fn.category} · {fn.label}{fn.available === false ? " (open its context)" : ""}</option>)}
      </select></label></UIField>
      <UIField id="ui:editor:destination" label="Placement destination" category="Interface"><label>Destination<select aria-label="Placement destination" value={destination} onChange={e => setDestination(e.target.value)}>
        <option value="">Workspace</option>{frames.map(([key, frame]) => <option key={key} value={key}>{frame.title}</option>)}
      </select></label></UIField>
      <UIAction id="ui:editor:placeControl" label="Place existing control" disabled={!chosen} onClick={() => place(chosen)} />
    </UISection>
    <UISection id="new-controls" title="Create a UI field">
      <small>Existing controls operate Omnium. New custom fields store their own values in your UI template.</small>
      <UIField id="ui:editor:newName" label="New field name" category="Interface"><label>Name<input aria-label="New field name" maxLength={240} value={name} onChange={e => setName(e.target.value)} /></label></UIField>
      <UIField id="ui:editor:newKind" label="New field type" category="Interface"><label>Type<select aria-label="New field type" value={kind} onChange={e => setKind(e.target.value as CustomControlKind)}>{CUSTOM_CONTROL_KINDS.map(kind => <option key={kind.id} value={kind.id}>{kind.label}</option>)}</select></label></UIField>
      {kind === "select" && <UIField id="ui:editor:newOptions" label="New dropdown choices" category="Interface"><label>Choices (one per line)<textarea aria-label="New dropdown choices" value={options} onChange={e => setOptions(e.target.value)} /></label></UIField>}
      <UIAction id="ui:editor:createControl" label="Create field" disabled={!name.trim()} onClick={() => {
        const id = `ui:custom:${crypto.randomUUID()}`, point = placement();
        try {
          ui.update(layout => {
            const next = addCustomControl({ ...layout, windows: { ...Object.fromEntries(ui.defaults), ...layout.windows } }, id, customControl(name, kind, options.split("\n")), point.x, point.y);
            return destination && getContainer(next, destination)
              ? dockResident(updateContainer(next, destination, { closed: false, collapsed: false }), `function:${id}`, destination, getContainer(next, destination)?.members?.length ?? 0)
              : next;
          });
          setNotice(`Created ${name}. It is saved with the UI, and can be moved like any field.`);
        } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
      }} />
    </UISection>
    <UISection id="frame-library" title="Frames & categories" defaultExpanded={false}>
      <small>Drag a complete frame to move its contents together. Use its name to open its appearance editor.</small>
      <div className="ui-editor-frame-list">{frames.map(([key]) => <button key={key} type="button" data-ui-drag={key} data-ui-inline-handle draggable={true}
        onDragStart={event => startResidentDrag(event, key)} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); ui.frameMenu(key, event.clientX, event.clientY); }} onClick={() => ui.configureFrame(key)}>{nameFor(ui, key)}</button>)}</div>
    </UISection>
    <UISection id="ui-coverage" title="UI coverage" defaultExpanded={false}>
      <UIAction id="ui:editor:scan" label="Find unregistered UI parts" onClick={() => { const parts = unregisteredUIParts(); setUnregistered(parts); setNotice(parts.length ? `${parts.length} visible controls bypass the shared registry.` : "All visible frame fields and headings use editable UI components."); }} />
      {unregistered.map((part, index) => <button key={index} onClick={() => { part.element.scrollIntoView({ block: "center" }); part.element.focus(); part.element.classList.add("ui-search-found"); setTimeout(() => part.element.classList.remove("ui-search-found"), 1800); }}>{part.label}</button>)}
    </UISection>
    {notice && <p role="status">{notice}</p>}
  </FloatingWindow>;
}
