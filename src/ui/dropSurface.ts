import { canDock, getContainer, type UILayout } from "./layout.ts";

/** The visible frame, not just its usually smaller content allocation, owns a
 * release in its interior. Sidebar strips retain their existing handle rules. */
export function pointedDropSurface(elements: Element[]): HTMLElement | undefined {
  const root = elements.map(element => element.closest<HTMLElement>("[data-ui-resident-root]"))
    .find((element): element is HTMLElement => !!element);
  return root && !root.matches(".ui-native-strip-frame,.ui-docked-panel:not(.ui-menu-panel)") ? root : undefined;
}
export function frameInteriorDrop(layout: UILayout, sources: string[], target: string | undefined, hasZone: boolean): "dock" | "blocked" | undefined {
  if (!target) return;
  const container = getContainer(layout, target);
  if (!container || container.closed || container.collapsed) return;
  // A visible but incompatible frame must never silently turn into a free drop.
  if (!hasZone || sources.some(source => !canDock(layout, source, target))) return "blocked";
  return "dock";
}
