import { Children, isValidElement, type ReactNode } from "react";
import { ancestry, type Target } from "../appearance/model";
import { TARGETS, type RegisteredTarget } from "../appearance/registry";
import type { UIFunction } from "./context";
import { getContainer, ownerOf, residentPinned, type UILayout } from "./layout";

export const UI_RIGIDITY_PROPERTY = "uiRigidity";
const prefix = "ui-rigidity:";
const targetHierarchy = [...TARGETS];
const categories = new Set([
  "all", "ui", "ui.windows", "ui.contents", "ui.fields", "ui.buttons",
  "ui.fields.single", "ui.fields.multi", "ui.fields.search", "ui.fields.number",
  "ui.fields.select", "ui.toggles", "ui.sliders", "ui.swatches",
]);
type Functions = readonly Pick<UIFunction, "id" | "control" | "rigidityTarget" | "homePath" | "scope">[];

/** Fields keep their category when their complete resident moves to another home. */
export function fieldRigidityTarget(node: ReactNode): string {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ type?: string; children?: ReactNode }>(child)) continue;
    if (child.type === "textarea") return "ui.fields.multi";
    if (child.type === "select") return "ui.fields.select";
    if (child.type === "input") return ({
      search: "ui.fields.search", number: "ui.fields.number", range: "ui.sliders",
      color: "ui.swatches", checkbox: "ui.toggles", radio: "ui.toggles",
    } as Record<string, string>)[child.props.type ?? "text"] ?? "ui.fields.single";
    const nested = fieldRigidityTarget(child.props.children);
    if (nested !== "ui.fields") return nested;
  }
  return "ui.fields";
}
export function rigidityCategory(key: string, functions: Functions): string {
  if (!key.startsWith("function:")) return "ui.windows";
  const fn = functions.find(fn => fn.id === key.slice(9));
  return fn?.rigidityTarget ?? (fn?.control ? "ui.fields" : "ui.buttons");
}
const residentPath = (layout: UILayout, key: string, functions: Functions) => {
  const path: string[] = [], seen = new Set<string>();
  const parent = (resident: string): string | undefined => {
    const owner = ownerOf(layout, resident);
    if (owner || !resident.startsWith("function:")) return owner;
    const id = resident.slice(9), item = layout.items[id];
    if (item?.home === false && !item.anchorId) return undefined;
    const fn = functions.find(fn => fn.id === id);
    const home = item?.anchorId?.split("|")[0] ?? fn?.homePath?.at(-1) ?? fn?.scope;
    return home === "workspace" ? undefined : home;
  };
  for (let owner: string | undefined = key; owner && !seen.has(owner); owner = parent(owner)) {
    seen.add(owner); path.unshift(owner);
  }
  return path;
};
/** Missing policy means fixed, including layouts saved before edit-mode rigidity existed. */
export function residentRigid(layout: UILayout, key: string, functions: Functions): boolean {
  const rules = layout.uiRigidity ?? {};
  let rigid = true;
  for (const id of ancestry(targetHierarchy, rigidityCategory(key, functions)))
    if (rules[id] !== undefined) rigid = rules[id];
  for (const owner of residentPath(layout, key, functions))
    if (rules[prefix + owner] !== undefined) rigid = rules[prefix + owner];
  return rigid;
}
/** One layout permission shared by pointer/native dragging, resizing and arrangement commands. */
export function residentMovable(layout: UILayout, key: string, functions: Functions): boolean {
  if (getContainer(layout, key)?.viewport) return false;
  if (!layout.panels["@devMode"] && !layout.uiRigidity) return false;
  return !!key && !residentPath(layout, key, functions).some(owner => residentPinned(layout, owner)) &&
    (!!layout.panels["@devMode"] || !residentRigid(layout, key, functions));
}
export function rigidityTargets(
  targets: RegisteredTarget[], layout: UILayout, functions: UIFunction[],
  names: ReadonlyMap<string, { title: string }>,
): RegisteredTarget[] {
  const keys = new Map<string, string>([
    ...Object.keys(layout.windows).map(id => [`window:${id}`, names.get(`window:${id}`)?.title ?? id] as const),
    ...layout.frames.map(frame => [`frame:${frame.id}`, names.get(`frame:${frame.id}`)?.title ?? frame.name] as const),
    // Inventory controls describe residents; listing their generated rows would
    // recursively create more controls/rows. Category rules still cover them.
    ...functions.filter(fn => fn.scope !== "window:appearance:hierarchy" &&
      !fn.homePath?.includes("window:appearance:hierarchy")).map(fn => [`function:${fn.id}`, fn.label] as const),
    ["window:global-ui-search", "Global UI search"],
  ]);
  return [
    ...targets.map(target => ({ ...target, properties: categories.has(target.id) ? [UI_RIGIDITY_PROPERTY] : [] })),
    ...[...keys].map(([key, label]) => ({
      id: prefix + key, parent: TARGETS.find(target => target.id === rigidityCategory(key, functions))?.hidden
        ? "ui.fields" : rigidityCategory(key, functions),
      label: layout.labels?.[key] ?? label, properties: [UI_RIGIDITY_PROPERTY],
      instance: { base: rigidityCategory(key, functions), owner: key, label, path: residentPath(layout, key, functions) },
    })),
  ];
}
export function rigidityIncluded(layout: UILayout, targets: Target[], id: string, functions: Functions): boolean {
  if (id.startsWith(prefix)) return residentRigid(layout, id.slice(prefix.length), functions);
  let rigid = true;
  for (const ancestor of ancestry(targets, id))
    if (layout.uiRigidity?.[ancestor] !== undefined) rigid = layout.uiRigidity[ancestor];
  return rigid;
}
// Keep the full resident inventory for category policies and hover targeting,
// but expose individual rows only after a local customization exists.
export function rigidityRowVisible(target: RegisteredTarget, localTargets: RegisteredTarget[], layout: UILayout): boolean {
  if (!target.id.startsWith(prefix)) return true;
  return layout.uiRigidity?.[target.id] !== undefined ||
    localTargets.some(local => local.instance?.owner === target.instance?.owner);
}
export function toggleRigidity(layout: UILayout, targets: Target[], id: string, functions: Functions): UILayout {
  const value = !rigidityIncluded(layout, targets, id, functions), rules = { ...layout.uiRigidity };
  if (id === "all") return { ...layout, uiRigidity: { all: value } };
  for (const target of targets) {
    const descendant = ancestry(targets, target.id).includes(id) ||
      (id.startsWith(prefix) && target.instance && residentPath(layout, target.instance.owner, functions).includes(id.slice(prefix.length)));
    if (descendant) delete rules[target.id];
  }
  rules[id] = value;
  return { ...layout, uiRigidity: rules };
}
