import { Children, isValidElement, useLayoutEffect, type ReactNode } from "react";
import { useUI } from "./context";
import { getContainer, ownerOf, residentKey, type WindowState } from "./layout";

/** Native menu/sidebar frames and user-docked frames share one reorderable row/column. */
export function UIFrameStrip({ id, vertical = false, children }: { id: string; vertical?: boolean; children: ReactNode }) {
  const ui = useUI(), container = `window:native:${id}`;
  const native = Children.toArray(children).filter(isValidElement<{ id: string }>).filter(child => typeof child.props.id === "string");
  const nativeKeys = native.map(child => `window:panel:${child.props.id}`);
  const initial: WindowState = { x: 0, y: 0, width: 320, height: 560, collapsed: false, pinned: false, members: [] };
  useLayoutEffect(() => { ui.defaults.set(`native:${id}`, initial); return () => { ui.defaults.delete(`native:${id}`); }; }, [id]);
  const members = getContainer(ui.layout, container)?.members ?? [];
  // Older sidebar order stores plain panel IDs. Keep those templates working.
  const saved = (ui.layout.nativeOrders?.[id] ?? []).map(key => nativeKeys.includes(`window:panel:${key}`) ? `window:panel:${key}` : key);
  const keys = [...new Set([...saved, ...nativeKeys, ...members.map(residentKey)])];
  return <div className={`ui-frame-strip ${vertical ? "is-vertical" : ""}`} data-ui-frame-strip={container} data-ui-frame-order={id} data-ui-frame-native={JSON.stringify(nativeKeys)}>
    {native.map(child => {
      const key = `window:panel:${child.props.id}`;
      const away = !!ownerOf(ui.layout, key) || ui.layout.panels[child.props.id];
      return <div key={key} className={`ui-native-frame-slot ${away ? "is-away" : ""}`} data-ui-frame-slot={away ? undefined : key} style={{ order: keys.indexOf(key) }}>{child}</div>;
    })}
    {members.filter(m => !nativeKeys.includes(residentKey(m))).map(member => <div key={residentKey(member)} className="ui-native-frame-slot" data-ui-frame-slot={residentKey(member)} style={{ order: keys.indexOf(residentKey(member)) }}>{ui.renderResident(member)}</div>)}
  </div>;
}
