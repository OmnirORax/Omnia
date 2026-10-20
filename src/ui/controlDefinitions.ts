export type CustomControlKind = "text" | "number" | "toggle" | "select" | "note";
export type CustomUIControl = {
  label: string;
  kind: CustomControlKind;
  value: string | number | boolean;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
};
export const CUSTOM_CONTROL_KINDS: { id: CustomControlKind; label: string }[] = [
  { id: "text", label: "Text field" }, { id: "number", label: "Number field" },
  { id: "toggle", label: "Checkbox" }, { id: "select", label: "Dropdown" }, { id: "note", label: "Note" },
];
export function validateCustomControls(value: unknown): asserts value is Record<string, CustomUIControl> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length > 200)
    throw new Error("Invalid custom UI controls.");
  for (const [id, raw] of Object.entries(value)) {
    const field = raw as CustomUIControl;
    if (!id.startsWith("ui:custom:") || id.length > 200 || !field || typeof field !== "object" ||
      typeof field.label !== "string" || !field.label.trim() || field.label.length > 240 ||
      !CUSTOM_CONTROL_KINDS.some(kind => kind.id === field.kind)) throw new Error("Invalid custom UI field.");
    if (field.kind === "toggle" ? typeof field.value !== "boolean" : field.kind === "number"
      ? typeof field.value !== "number" || !Number.isFinite(field.value) || Math.abs(field.value) > 100000
      : typeof field.value !== "string" || field.value.length > 8000) throw new Error("Invalid custom UI value.");
    for (const key of ["min", "max", "step"] as const)
      if (field[key] !== undefined && (typeof field[key] !== "number" || !Number.isFinite(field[key]) || Math.abs(field[key]) > 100000))
        throw new Error("Invalid custom field limits.");
    if (field.step !== undefined && field.step <= 0 || field.min !== undefined && field.max !== undefined && field.min > field.max)
      throw new Error("Invalid custom field limits.");
    if (field.options !== undefined && (!Array.isArray(field.options) || field.options.length > 100 ||
      field.options.some(option => typeof option !== "string" || !option.trim() || option.length > 160) || new Set(field.options).size !== field.options.length))
      throw new Error("Invalid custom dropdown options.");
    if (field.kind === "select" && (!field.options?.length || !field.options.includes(String(field.value))))
      throw new Error("Custom dropdown value is not an available option.");
  }
}
