import { roleFor } from "./visualRole.ts";
import type { Target } from "./model.ts";
type VisualTarget = Target & { hidden?: boolean; binding?: { role?: import("./visualRole.ts").VisualRole; css?: string; text?: boolean; selection?: { role: string } } };
export function visualRoleGroup(target: VisualTarget) {
  const detected = roleFor(target);
  if (!detected) return undefined;
  const names = { background: ["visual.role.backgrounds", "Backgrounds"], contour: ["visual.role.contours", "Contours"],
    text: ["visual.role.text", "Text"], icon: ["visual.role.icons", "Icons"], indicator: ["visual.role.indicators", "Indicators"] } as const;
  const [id, label] = names[detected]; return { id, label };
}
/** Compile the detected renderer contract into role-first groups. No component
 * IDs, selector scans or per-feature category list participate in classification. */
export function groupVisualRoles<T extends VisualTarget>(source: readonly T[]): T[] {
  const byId = new Map(source.map(target => [target.id, target]));
  const result = source.map(target => ({ ...target }));
  const generated = new Map<string, T>();
  const ensure = (id: string, parent: string, label: string) => {
    if (!byId.has(id) && !generated.has(id)) generated.set(id, { id, parent, label } as T);
  };
  for (const target of result) {
    if (!target.properties || target.hidden) continue;
    const group = visualRoleGroup(target);
    if (!group) continue;
    const ancestors: string[] = [], seen = new Set<string>();
    for (let key = target.parent; key && !seen.has(key); key = byId.get(key)?.parent) { seen.add(key); ancestors.unshift(key); }
    const root = group.id;
    if (ancestors.includes(root)) continue;
    ensure(root, "all", group.label);
    // The existing detection path supplies system identity/caption automatically.
    const system = ancestors.find(id => id !== "all" && !(group.id === "visual.role.text" && id === "text"));
    const family=ancestors.find(id=>byId.get(id)?.roleLayout==='within');
    const parent = family ? `${family}.${root}` : system ? `${root}.${system}` : root;
    if(family)ensure(parent,family,group.label);
    else if (system) ensure(parent, root, byId.get(system)?.label ?? system);
    const owner = target.parent && byId.get(target.parent);
    target.legacyAncestors = [...new Set([...(target.legacyAncestors??[]),...ancestors.flatMap(id=>byId.get(id)?.legacyAncestors??[]),...ancestors,...(family?[root]:[])])];
    target.parent = parent;
    if (owner && owner.id !== "all" && owner.id !== system) {
      const generic = /^(background|area background|outer contour|contour)$/i.test(target.label);
      target.label = generic ? owner.label : `${owner.label} · ${target.label}`;
    }
  }
  // Retain old IDs/policies, hiding only structural branches whose visible
  // children were all regrouped. This also supports old saved targeting rules.
  const visibleParents = new Set([...generated.values(),...result].filter(t => !t.hidden).map(t => t.parent));
  let changed = true;
  while (changed) {
    changed = false;
    for (const target of result) if (target.parent && !target.properties && !target.hidden && !visibleParents.has(target.id)) {
      target.hidden = true; changed = true;
    }
    if (changed) { visibleParents.clear(); for (const t of [...generated.values(),...result]) if (!t.hidden) visibleParents.add(t.parent); }
  }
  return [...generated.values(), ...result];
}
