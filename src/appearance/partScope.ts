import { EFFECT_PROPERTIES } from "../properties/catalog.ts";
/** Serializable visual-part addresses, separate from property definitions and values. */
export const PART_KEYS = ["id", "data-ui-id", "data-property-node", "data-appearance-target"] as const;
export type PartStep = { tag: string; index: number; key?: typeof PART_KEYS[number]; value?: string };
export type PartScope = { steps: PartStep[]; text?: number };
export const GLYPH_PROPERTIES = ["color", "brightness", "opacity", "glow", ...EFFECT_PROPERTIES];
export function normalizePartScope(input: unknown): PartScope | undefined {
  if (!input || typeof input !== "object") return;
  const part = input as PartScope;
  if (!Array.isArray(part.steps) || part.steps.length > 64 || part.steps.some(step =>
    !step || typeof step.tag !== "string" || !/^[a-zA-Z][\w-]*$/.test(step.tag) ||
    !Number.isInteger(step.index) || step.index < 1 || step.index > 10000 ||
    (step.key !== undefined && (!PART_KEYS.includes(step.key) || typeof step.value !== "string" || step.value.length > 600)))) return;
  if (part.text !== undefined && (!Number.isInteger(part.text) || part.text < 0 || part.text > 10000)) return;
  return { steps: part.steps.map(({ tag, index, key, value }) => ({ tag, index: key ? 1 : index, ...(key ? { key, value } : {}) })),
    ...(part.text !== undefined ? { text: part.text } : {}) };
}
const quote = (value: string) => '"' + value.replace(/[\\"\n\r\f]/g, c => `\\${c.charCodeAt(0).toString(16)} `) + '"';
export const ownerSelector = (owner: string) => owner === "app" ? "body" : owner.startsWith("function:")
  ? `[data-ui-function=${quote(owner.slice(9))}]:not([data-ui-native-hidden])`
  : `:is([data-ui-resident-root=${quote(owner)}],[data-ui-proxy-for=${quote(owner)}])`;
export function partSelector(instance: { owner: string; part?: PartScope }): string {
  return ownerSelector(instance.owner) + (instance.part?.steps ?? []).map(step =>
    ` > ${step.tag}${step.key ? `[${step.key}=${quote(step.value!)}]` : `:nth-of-type(${step.index})`}`).join("");
}
/** Only broader refinements can supply a missing value; siblings never inherit one another. */
export function scopeContains(parent: { owner: string; part?: PartScope }, child: { owner: string; part?: PartScope; path?: string[] }): boolean {
  if (!parent.part) return parent.owner === child.owner || !!child.path?.includes(parent.owner);
  if (!child.part || parent.owner !== child.owner || parent.part.steps.length > child.part.steps.length) return false;
  if (!parent.part.steps.every((step, i) => {
    const other = child.part!.steps[i];
    return step.tag === other.tag && (step.key ? step.key === other.key && step.value === other.value : !other.key && step.index === other.index);
  })) return false;
  return parent.part.text === undefined || (parent.part.steps.length === child.part.steps.length && parent.part.text === child.part.text);
}
export const scopeDepth = (instance: { owner: string; path?: string[]; part?: PartScope }) =>
  (instance.path?.length ?? 0) * 1000 + Number(instance.owner.startsWith("function:")) * 100 +
  (instance.part ? instance.part.steps.length + 1 + Number(instance.part.text !== undefined) / 2 : 0);
