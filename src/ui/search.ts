import type { UIContextValue, UIFunction } from "./context";
import { frameControls, nameFor, rootFor, type SearchResult } from "./FrameSearch";
import { activateDockMember, getContainer, ownerOf, updateContainer, type UILayout } from "./layout";
import { PROPERTIES, type RegisteredTarget } from '../appearance/registry';
import { ancestry } from '../appearance/model';
import type { AppearanceLocation } from '../appearance/Context';
import { APPEARANCE_HIERARCHY_ID } from '../appearance/propertyTree';

export type SearchReveal = { path: string[] };
export type GlobalResult = SearchResult & { heading: string; home: string; available: boolean; container?: string; appearance?:AppearanceLocation; appearanceProperties?: { id: string; label: string }[] };
const titles: Record<string, string> = {
  [`window:${APPEARANCE_HIERARCHY_ID}`]: "Visual hierarchy",
  "window:theme": "Master controller", "window:settings": "Workspace settings",
  "window:shortcuts": "Shortcut display", "window:panel:menu:file": "File",
  "window:panel:menu:create": "Create", "window:panel:menu:view": "View",
  "window:panel:menu:workspace": "Workspace", "window:panel:reuse": "Reuse identity",
  "window:panel:hierarchy": "Hierarchy", "window:panel:frames": "Investigative frames",
  "window:panel:inspector": "Inspector", "window:panel:connections": "Connect nodes",
  "window:panel:types": "Relationship types", "window:panel:relationships": "Relationships",
  "window:panel:ai": "External AI proposal", "window:panel:help": "Workspace help",
};
export const searchTitle = (ui: UIContextValue, key: string) => ui.layout.labels?.[key] ?? ui.frameActions.get(key)?.title ?? titles[key] ?? nameFor(ui, key);
function nativeHome(fn: UIFunction): string {
  const id = fn.id;
  if (fn.homePath?.length) return fn.homePath[0];
  if (id.startsWith("ui:native:") && fn.scope) return fn.scope;
  if (/^ui:(master:|appearance:|animation:|themePreset:|glow$|resetAppearance$|atmosphere$)/.test(id)) return "window:theme";
  if (/^(shortcut:|ui:(sphereDiameter|radius|clearance|settingsSnap|subtreeModifier|gesture:|mouse:|camera:))/.test(id)) return "window:settings";
  if (/^ui:(import|export|saveTemplate|loadTemplate)$/.test(id)) return "window:panel:menu:file";
  if (/^ui:(view|newView|flow)/.test(id)) return "window:panel:menu:view";
  if (/^field:(frame|reopen-frame|lock-frame|find-frame|exploration-depth)/.test(id)) return "window:panel:frames";
  if (id === "field:find-existing-identity") return "window:panel:reuse";
  if (/^field:new-relationship/.test(id)) return "window:panel:connections";
  if (id === "ui:defineType") return "window:panel:types";
  if (id === "ui:reviewProposal") return "window:panel:ai";
  if (id === "ui:startInvestigation") return "window:panel:frames";
  if (/^(appearance:|visual:|binder:|field:(node-|entity-|structural-|hide-this|3D |relationship-))/.test(id)) return "window:panel:inspector";
  if (id.startsWith("context:node:")) return "window:context:node";
  if (id.startsWith("context:selection:")) return "window:context:selection";
  return "workspace";
}
function sectionFor(id: string): string | undefined {
  if(id.startsWith('ui:master:'))return 'Master controller';
  if (/^ui:(animation:|appearance:(effect$|effectIntensity$|density$|motion$))/.test(id)) return "Animations";
  if (/^ui:themePreset:/.test(id)) return "Theme templates";
  if (/^ui:appearance:(windowOpacity|blur)$/.test(id)) return "Windows";
  return "Appearance";
}
/** Ownership wins over default homes so customized frames remain discoverable. */
export function globalControls(ui: UIContextValue, appearanceTargets:RegisteredTarget[]=[]): GlobalResult[] {
  const mounted = frameControls(ui, "workspace"), byFunction = new Map(mounted.filter(r => r.functionId).map(r => [r.functionId!, r]));
  const results: GlobalResult[] = [];
  const add = (result: SearchResult, fn?: UIFunction) => {
    const floating = result.functionId && ui.layout.items[result.functionId]?.home === false && !ownerOf(ui.layout, `function:${result.functionId}`) && !ui.layout.items[result.functionId]?.anchorId;
    let home = result.path.at(-1) ?? (floating ? "workspace" : nativeHome(fn!));
    const explicit = result.functionId ? ownerOf(ui.layout, `function:${result.functionId}`) : undefined;
    if (explicit) home = explicit;
    const path: string[] = [];
    let current: string | undefined = home;
    const seen = new Set<string>();
    while (current && current !== "workspace" && !seen.has(current)) {
      seen.add(current); path.unshift(current);
      current = ownerOf(ui.layout, current);
    }
    // Native sidebar/frame DOM can add ancestors absent from the saved ownership map.
    if (!explicit && result.path.length) path.splice(0, path.length, ...result.path);
    const heading = path.map(key => searchTitle(ui, key));
    const section = result.element?.closest<HTMLElement>("section[aria-label]");
    if (section && section.closest("[data-ui-resident-root]") === result.element?.closest("[data-ui-resident-root]")) heading.push(section.getAttribute("aria-label")!);
    else if (home === "window:theme" && result.functionId) heading.push(sectionFor(result.functionId)!);
    if (!heading.length) heading.push(fn?.category ?? "Workspace");
    results.push({ ...result, path, home, heading: heading.join(" › "), available: fn?.available !== false, appearance:fn?.id.startsWith('ui:master:')?{target:'all',property:fn.id.slice(10)}:undefined });
  };
  for (const fn of ui.functions) {
    if (fn.id === "searchUI") continue;
    const moved = ui.layout.items[fn.id];
    const fallbackPath = moved && !moved.home && !moved.anchorId && !ownerOf(ui.layout, `function:${fn.id}`) ? [] : fn.homePath?.length ? fn.homePath : [nativeHome(fn)];
    const found = byFunction.get(fn.id);
    add(found ?? { key: `function:${fn.id}`, label: fn.label, functionId: fn.id, path: fallbackPath.filter(key => key !== "workspace") }, fn);
  }
  // Windows are destinations themselves, even if their controls are unmounted.
  const windowKeys = new Set([...Object.keys(titles), ...ui.layout.frames.map(frame => `frame:${frame.id}`), ...ui.frameActions.keys()]);
  for (const key of windowKeys) {
    const path: string[] = [], seen = new Set<string>();
    let current: string | undefined = key;
    while (current && current !== "workspace" && !seen.has(current)) {
      seen.add(current); path.unshift(current); current = ownerOf(ui.layout, current);
    }
    results.push({ key: `container:${key}`, container: key, label: searchTitle(ui, key),
      heading: "Windows / frames", home: key, path, available: true });
  }
  const hierarchy = `window:${APPEARANCE_HIERARCHY_ID}`;
  const hierarchyOwners: string[] = [];
  const effective = { ...ui.layout, windows: { ...Object.fromEntries(ui.defaults), ...ui.layout.windows } };
  for(let key: string | undefined = hierarchy; key && key !== 'workspace' && !hierarchyOwners.includes(key); key = ownerOf(effective, key)) hierarchyOwners.unshift(key);
  // The source window mounts the live controller even when its group lives elsewhere.
  const hierarchyPath = [...new Set(['window:theme', ...hierarchyOwners])];
  const targetIndex = new Map(appearanceTargets.map(target => [target.id, target]));
  const propertyNames = new Map(PROPERTIES.map(property => [property.id, ui.layout.labels?.[`window:property:master:${property.id}`] ?? property.label]));
  for (const target of appearanceTargets.filter(target => !target.hidden && !target.instance)) {
    const parents = ancestry(appearanceTargets, target.id).slice(1, -1);
    results.push({ key: `appearance:${target.id}`, label: target.label,
      heading: [...hierarchyPath.map(key => searchTitle(ui, key)), ...parents.map(id => targetIndex.get(id)!.label)].join(" › "),
      home: hierarchy, path: hierarchyPath, available: true, appearance: { target: target.id },
      appearanceProperties: target.properties?.map(id => ({ id, label: propertyNames.get(id) ?? id })) });
  }
  return results.sort((a, b) => a.heading.localeCompare(b.heading) || a.label.localeCompare(b.label));
}
/** Only display state changes. Applied as an overlay while hovering, never saved. */
export function revealSearchPath(layout: UILayout, reveal: SearchReveal | null): UILayout {
  if (!reveal) return layout;
  let next = layout;
  for (const key of reveal.path) {
    next = activateDockMember(next, key);
    const flag = key === "window:theme" ? "@theme" : key === "window:settings" ? "@settings" : key === "window:shortcuts" ? "@shortcuts" : key === "window:function-library" ? "@library" : undefined;
    if (flag) next = { ...next, panels: { ...next.panels, [flag]: true } };
    const container = getContainer(next, key);
    if (container?.collapsed || container?.closed) next = updateContainer(next, key, { collapsed: false, closed: false });
  }
  return next;
}
export function locateSearchResult(result: GlobalResult): HTMLElement | undefined {
  if (result.container) return rootFor(result.container) ?? undefined;
  const root = rootFor(result.home) ?? document.body;
  if(result.appearance){
    if(result.functionId)return [...root.querySelectorAll<HTMLElement>('[data-ui-function]:not([data-ui-native-hidden])')].find(el=>el.dataset.uiFunction===result.functionId);
    const row=[...root.querySelectorAll<HTMLElement>('[data-appearance-target]')].find(el=>el.dataset.appearanceTarget===result.appearance!.target)?.querySelector<HTMLElement>(':scope > .appearance-row');
    return result.appearance.property ? row?.querySelector<HTMLElement>('input,select,[aria-pressed="true"],.property-options button') ?? row ?? undefined : row ?? undefined;
  }
  if (result.functionId) return [...root.querySelectorAll<HTMLElement>("[data-ui-function]:not([data-ui-native-hidden])")].find(element => element.dataset.uiFunction === result.functionId && !element.closest("[data-ui-search],[data-ui-palette],[data-shortcut-runner]"));
  return result.element?.isConnected ? result.element : undefined;
}
