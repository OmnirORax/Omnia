import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useUI } from "./context";
import { CUSTOM_CONTROL_KINDS, type CustomUIControl } from "./controlDefinitions";
import { customControl } from "./authoring";
import { UIField } from "./UIField";

/** Definitions remain live independently of where their controls are placed. */
export function CustomControls() {
  const ui = useUI();
  const signature = JSON.stringify(Object.entries(ui.layout.customControls ?? {}).map(([id, field]) => [id, field.label]));
  useLayoutEffect(() => {
    const cleanups = Object.entries(ui.layout.customControls ?? {}).map(([id, field]) => ui.registerFunction({
      id, label: field.label, category: "Interface", control: true, element: <CustomControlValue id={id} />,
    }));
    return () => cleanups.forEach(cleanup => cleanup());
  }, [signature, ui.registerFunction]);
  return null;
}
function CustomControlValue({ id }: { id: string }) {
  const ui = useUI(), field = ui.layout.customControls?.[id];
  if (!field) return null;
  const label = ui.layout.labels?.[`function:${id}`] ?? field.label;
  const change = (value: string | number | boolean) => ui.update(layout => ({ ...layout,
    customControls: { ...layout.customControls, [id]: { ...layout.customControls![id], value } },
  }));
  return <label className={field.kind === "toggle" ? "ui-checkbox-control" : undefined}>
    {label}
    {field.kind === "toggle" ? <input aria-label={label} type="checkbox" checked={Boolean(field.value)} onChange={e => change(e.target.checked)} />
      : field.kind === "select" ? <select aria-label={label} value={String(field.value)} onChange={e => change(e.target.value)}>{field.options!.map(option => <option key={option}>{option}</option>)}</select>
      : field.kind === "note" ? <textarea aria-label={label} value={String(field.value)} maxLength={8000} onChange={e => change(e.target.value)} />
      : field.kind === "number" ? <CustomNumberInput field={field} label={label} onChange={change} />
      : <input aria-label={label} value={String(field.value)} maxLength={8000} onChange={e => change(e.target.value)} />}
  </label>;
}
function CustomNumberInput({ field, label, onChange }: { field: CustomUIControl; label: string; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(field.value)), editing = useRef(false);
  useEffect(() => { if (!editing.current) setDraft(String(field.value)); }, [field.value]);
  return <input aria-label={label} type="number" value={draft} min={field.min} max={field.max} step={field.step ?? 1}
    onFocus={() => { editing.current = true; }} onChange={event => {
      setDraft(event.target.value);
      const value = event.target.valueAsNumber;
      if (Number.isFinite(value) && Math.abs(value) <= 100000) onChange(value);
    }} onBlur={event => {
      editing.current = false;
      const value = event.target.valueAsNumber;
      const next = Number.isFinite(value) ? Math.max(field.min ?? -100000, Math.min(field.max ?? 100000, value)) : Number(field.value);
      setDraft(String(next)); if (next !== field.value) onChange(next);
    }} />;
}
export function CustomControlSettings({ id }: { id: string }) {
  const ui = useUI(), field = ui.layout.customControls?.[id];
  if (!field) return null;
  const patch = (changes: Partial<typeof field>) => ui.update(layout => ({ ...layout, customControls: {
    ...layout.customControls, [id]: { ...layout.customControls![id], ...changes },
  } }));
  return <>
    <UIField id="ui:editor:fieldKind" label="Custom field type" category="Interface"><label>Field type<select aria-label="Custom field type" value={field.kind}
      onChange={e => patch(customControl(field.label, e.target.value as typeof field.kind))}>{CUSTOM_CONTROL_KINDS.map(kind => <option key={kind.id} value={kind.id}>{kind.label}</option>)}</select></label></UIField>
    {field.kind === "select" && <UIField id="ui:editor:fieldOptions" label="Dropdown choices" category="Interface"><label>Choices (one per line)<textarea defaultValue={field.options?.join("\n")}
      onBlur={e => { const options = [...new Set(e.target.value.split("\n").map(option => option.trim()).filter(Boolean))].slice(0, 100); if (options.length) patch({ options, value: options.includes(String(field.value)) ? field.value : options[0] }); }} /></label></UIField>}
    {field.kind === "number" && (["min", "max", "step"] as const).map(key => <UIField key={key} id={`ui:editor:field-${key}`} label={`Custom field ${key}`} category="Interface"><label>{key}
      <input type="number" value={field[key] ?? ""} min={key === "step" ? .001 : undefined} onChange={e => {
        const value = e.target.value === "" ? undefined : e.target.valueAsNumber;
        if (value !== undefined && (!Number.isFinite(value) || Math.abs(value) > 100000 || key === "step" && value <= 0 || key === "min" && value > (field.max ?? Infinity) || key === "max" && value < (field.min ?? -Infinity))) return;
        patch({ [key]: value });
      }} /></label></UIField>)}
  </>;
}
