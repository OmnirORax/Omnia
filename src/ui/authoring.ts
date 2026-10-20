import { releaseResident, floatResident, validateUILayout, type UILayout } from "./layout.ts";
import type { CustomControlKind, CustomUIControl } from "./controlDefinitions.ts";

export function customControl(label: string, kind: CustomControlKind, options = ["Option 1", "Option 2"]): CustomUIControl {
  const choices = [...new Set(options.map(option => option.trim()).filter(Boolean))];
  return { label: label.trim(), kind, value: kind === "toggle" ? false : kind === "number" ? 0 : kind === "select" ? choices[0] ?? "Option 1" : "",
    ...(kind === "select" ? { options: choices.length ? choices : ["Option 1"] } : {}),
    ...(kind === "number" ? { step: 1 } : {}),
  };
}
export function addCustomControl(layout: UILayout, id: string, control: CustomUIControl, x: number, y: number): UILayout {
  if (layout.customControls?.[id]) throw new Error("This UI control already exists.");
  return floatResident({ ...layout, customControls: { ...layout.customControls, [id]: control } }, `function:${id}`, x, y);
}
export function removeCustomControl(layout: UILayout, id: string): UILayout {
  const next = releaseResident(layout, `function:${id}`), controls = { ...next.customControls }, items = { ...next.items }, labels = { ...next.labels };
  delete controls[id]; delete items[id]; delete labels[`function:${id}`];
  return validateUILayout({ ...next, customControls: controls, items, labels });
}
