import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useUI } from "./context";
import { getContainer, ownerOf } from "./layout";
import { fitDockRect, fitDockResidents, workspaceDockRects, type DockRect } from "./docking";

export function dockWorkspaceArea(): DockRect {
  const workspace = document.querySelector(".workspace")?.getBoundingClientRect();
  const top = workspace?.top ?? document.querySelector(".toolbar")?.getBoundingClientRect().bottom ?? 8;
  return { x: (workspace?.x ?? 0) + 8, y: top, width: Math.max(1, (workspace?.width ?? innerWidth)-16), height: Math.max(1, (workspace?.height ?? innerHeight-top)-8) };
}
const Context = createContext<(ReturnType<typeof workspaceDockRects> & { source?: string; floating: DockRect; placements: Record<string, DockRect>; register: (key: string, rect: DockRect) => () => void }) | null>(null);
export function useDockWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Dock workspace is not mounted.");
  return value;
}
export function useDockResident(key: string, desired: DockRect, enabled = true, overflow = false) {
  const workspace = useDockWorkspace(), register = workspace.register;
  const held = workspace.source === key;
  const placement = enabled && !overflow && workspace.active ? workspace.placements[key] ?? fitDockRect(desired, workspace.floating) : desired;
  const resting = useRef(placement);
  if (!held) resting.current = placement;
  useLayoutEffect(() => enabled && !overflow && !held ? register(key, desired) : undefined, [key, enabled, overflow, held, desired.x, desired.y, desired.width, desired.height, register]);
  // Neighbors adapt, but React must not overwrite the held payload's direct
  // pointer transform with a newly allocated position.
  return held ? resting.current : placement;
}
/** Docks, native layout and floating residents share the same allocation during
 * hover and after release. Preview affects geometry, never saved UI ownership. */
export function DockWorkspace({ children, projection }: { children: ReactNode; projection: { current: ((key: string, rect: DockRect) => DockRect) | undefined } }) {
  const ui = useUI(), [area, setArea] = useState(dockWorkspaceArea), [sidebarWidth, setSidebarWidth] = useState(0);
  const allocation = useSyncExternalStore(ui.placementPreview.subscribe, () => ui.placementPreview.getSnapshot()?.allocation);
  const [residents, setResidents] = useState<Record<string, DockRect>>({});
  const register = useCallback((key: string, rect: DockRect) => {
    setResidents(old => ({ ...old, [key]: rect }));
    return () => setResidents(old => { if (old[key] !== rect) return old; const next = { ...old }; delete next[key]; return next; });
  }, []);
  const layout = allocation?.layout ?? ui.layout;
  const geometry = useMemo(() => workspaceDockRects(layout, area), [layout, area]);
  const floating = useMemo(() => geometry.active ? { ...geometry.center, x: geometry.center.x + sidebarWidth, width: Math.max(1, geometry.center.width-sidebarWidth) } : geometry.center, [geometry, sidebarWidth]);
  const visibleResidents = useMemo(() => {
    if (!allocation) return residents;
    const remaining = Object.fromEntries(Object.entries(residents).filter(([key]) =>
      key !== allocation.source && !ownerOf(layout, key) && !layout.frames.some(frame => `frame:${frame.id}` === key && frame.dockEdge) &&
      (!key.startsWith('frame:') || !!getContainer(layout, key))));
    // Reserve a proposed floating group just as its real frame will on release.
    const group = getContainer(layout, allocation.root);
    if (group && !ownerOf(layout, allocation.root) && !('dockEdge' in group && group.dockEdge) && !('nativeStrip' in group && group.nativeStrip) && !remaining[allocation.root])
      remaining[allocation.root] = { x: group.x, y: group.y, width: group.width ?? 280, height: group.height ?? 420 };
    return remaining;
  }, [allocation, layout, residents]);
  const placements = useMemo(() => geometry.active ? fitDockResidents(visibleResidents, floating) : {}, [geometry.active, visibleResidents, floating]);
  useLayoutEffect(() => {
    projection.current = (key, rect) => geometry.active ? fitDockResidents({ ...visibleResidents, [key]: rect }, floating)[key] : rect;
    return () => { projection.current = undefined; };
  }, [projection, geometry.active, visibleResidents, floating]);
  useLayoutEffect(() => {
    const workspace = document.querySelector<HTMLElement>(".workspace");
    let frame = 0;
    const measure = () => {
      const next = dockWorkspaceArea();
      setArea(old => Object.keys(next).every(key => Math.abs(old[key as keyof DockRect]-next[key as keyof DockRect]) < .5) ? old : next);
      setSidebarWidth(document.querySelector(".sidebar")?.getBoundingClientRect().width ?? 0);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); }); };
    const observer = new ResizeObserver(schedule);
    if (workspace) observer.observe(workspace);
    const toolbar = document.querySelector(".toolbar"); if (toolbar) observer.observe(toolbar);
    const sidebar = document.querySelector(".sidebar"); if (sidebar) observer.observe(sidebar);
    window.addEventListener("resize", schedule); measure();
    return () => { observer.disconnect(); window.removeEventListener("resize", schedule); cancelAnimationFrame(frame); };
  }, []);
  useLayoutEffect(() => {
    const workspace = document.querySelector<HTMLElement>(".workspace");
    if (!workspace) return;
    for (const [edge, value] of Object.entries(geometry.sizes)) workspace.style.setProperty(`--ui-dock-${edge}`, `${value + (geometry.active && edge !== "top" ? 8 : 0)}px`);
    workspace.dataset.uiDocks = String(geometry.active);
    return () => {
      for (const edge of Object.keys(geometry.sizes)) workspace.style.removeProperty(`--ui-dock-${edge}`);
      delete workspace.dataset.uiDocks;
    };
  }, [geometry]);
  return <Context.Provider value={{ ...geometry, source: allocation?.source, floating, placements, register }}>{children}</Context.Provider>;
}
