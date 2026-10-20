import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { useUI } from "./context";
import { fitDockRect, fitDockResidents, workspaceDockRects, type DockRect } from "./docking";

export function dockWorkspaceArea(): DockRect {
  const workspace = document.querySelector(".workspace")?.getBoundingClientRect();
  const top = workspace?.top ?? document.querySelector(".toolbar")?.getBoundingClientRect().bottom ?? 8;
  return { x: (workspace?.x ?? 0) + 8, y: top, width: Math.max(1, (workspace?.width ?? innerWidth)-16), height: Math.max(1, (workspace?.height ?? innerHeight-top)-8) };
}
const Context = createContext<(ReturnType<typeof workspaceDockRects> & { floating: DockRect; placements: Record<string, DockRect>; register: (key: string, rect: DockRect) => () => void }) | null>(null);
export function useDockWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Dock workspace is not mounted.");
  return value;
}
export function useDockResident(key: string, desired: DockRect, enabled = true) {
  const workspace = useDockWorkspace(), register = workspace.register;
  useLayoutEffect(() => enabled ? register(key, desired) : undefined, [key, enabled, desired.x, desired.y, desired.width, desired.height, register]);
  return enabled && workspace.active ? workspace.placements[key] ?? fitDockRect(desired, workspace.floating) : desired;
}
/** Docks, native layout and floating residents consume the same committed allocation.
 * No saved coordinates change when an edge opens, closes, resizes or is undone. */
export function DockWorkspace({ children, projection }: { children: ReactNode; projection: { current: ((key: string, rect: DockRect) => DockRect) | undefined } }) {
  const ui = useUI(), [area, setArea] = useState(dockWorkspaceArea), [sidebarWidth, setSidebarWidth] = useState(0);
  const [residents, setResidents] = useState<Record<string, DockRect>>({});
  const register = useCallback((key: string, rect: DockRect) => {
    setResidents(old => ({ ...old, [key]: rect }));
    return () => setResidents(old => { if (old[key] !== rect) return old; const next = { ...old }; delete next[key]; return next; });
  }, []);
  const geometry = useMemo(() => workspaceDockRects(ui.layout, area), [ui.layout, area]);
  const floating = useMemo(() => geometry.active ? { ...geometry.center, x: geometry.center.x + sidebarWidth, width: Math.max(1, geometry.center.width-sidebarWidth) } : geometry.center, [geometry, sidebarWidth]);
  const placements = useMemo(() => geometry.active ? fitDockResidents(residents, floating) : {}, [geometry.active, residents, floating]);
  useLayoutEffect(() => {
    projection.current = (key, rect) => geometry.active ? fitDockResidents({ ...residents, [key]: rect }, floating)[key] : rect;
    return () => { projection.current = undefined; };
  }, [projection, geometry.active, residents, floating]);
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
  return <Context.Provider value={{ ...geometry, floating, placements, register }}>{children}</Context.Provider>;
}
