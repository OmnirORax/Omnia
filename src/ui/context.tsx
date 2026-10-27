import {createSelectiveStore,createSliceReader} from './selectiveStore';
import type { ActiveContextStore, ContextLayer } from "./activeContextModel";
import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactElement, type ReactNode } from "react";
import type { UILayout, WindowState, UIResident, FrameLayoutMode } from "./layout";
import type { PlacementPreview } from "./drag";
import type { TransientStore } from "./transientStore";
export type UIFunction = {
  id: string;
  label: string;
  element: ReactElement;
  configuration?: ReactNode;
  control?: boolean;
  category?: string;
  available?: boolean;
  scope?: string;
  homePath?: string[];
  rigidityTarget?: string;
};
export type UICommand = { action: "select" | "compact" | "align" | "reset" | "createFrame"; sequence: number };
export type UIContextValue = {
  layout: UILayout;
  canMove: (key: string) => boolean;
  update: (change: (layout: UILayout) => UILayout) => void;
  functions: UIFunction[];
  shortcutBindings?: Record<string, string>;
  shortcutCapturing?: string | null;
  shortcutsBlocked?: boolean;
  registerFunction: (fn: UIFunction) => () => void;
  captureShortcut?: (id: string, label: string) => void;
  clearShortcut?: (id: string) => void;
  configure: (id: string | null) => void;
  configureFrame: (key: string) => void;
  createFrame: (x: number, y: number, mode?: FrameLayoutMode) => void;
  library: () => void;
  frameMenu: (key: string, x: number, y: number) => void;
  configureControl: (owner: string, control: "collapse" | "pin" | "close" | "branch") => void;
  placementPreview: TransientStore<PlacementPreview | null>;
  defaults: Map<string, WindowState>;
  activeContext: ActiveContextStore;
  contextLayers: Map<HTMLElement, ContextLayer>;
  frameActions: Map<
    string,
    {
      title: string;
      label: string;
      state: Pick<WindowState, "collapsed" | "pinned" | "chrome">;
      onChange: (patch: Partial<WindowState>) => void | boolean;
      onRename?: (value: string) => void;
      onClose?: () => void | boolean;
      onSearch?: () => boolean;
      onBranchToggle?: () => boolean;
      closeLabel?: string;
    }
  >;
  renderResident: (member: UIResident) => ReactNode;
  selectedFunctions: Set<string>;
  selectingUI: boolean;
  selectionMenu: (x: number, y: number) => void;
};
export const UIContext = createContext<UIContextValue | null>(null);
export const UIHomeContext = createContext("workspace");
export const UIPathContext = createContext<string[]>([]);
/** Native anchor identity stays at home while groups use separate container ownership. */
export const UIContainerContext = createContext<string | undefined>(undefined);
export const DockFillContext = createContext(false);
export function useUI() {
  const value = useContext(UIContext);
  if (!value) throw new Error("UI workspace is not mounted.");
  return value;
}

const UIStoreContext=createContext<ReturnType<typeof createSelectiveStore<UIContextValue>>|null>(null);
/** Publish after commit: selectors never observe an abandoned React render. */
export function UIProvider({value,children}:{value:UIContextValue;children:ReactNode}){
  const [store]=useState(()=>createSelectiveStore(value));
  useLayoutEffect(()=>store.publish(value),[store,value]);
  return <UIStoreContext.Provider value={store}><UIContext.Provider value={value}>{children}</UIContext.Provider></UIStoreContext.Provider>;
}
const emptySlice:readonly unknown[]=[];
const emptySubscribe=()=>()=>{};
export function useOptionalUITracked(select:(value:UIContextValue)=>readonly unknown[]):UIContextValue|null{
  const store=useContext(UIStoreContext);
  const latest=useRef(select);latest.current=select;
  const reader=useRef<{store:typeof store;read:ReturnType<typeof createSliceReader<UIContextValue>>}|null>(null);
  if(store&&reader.current?.store!==store)reader.current={store,read:createSliceReader(store.getSnapshot)};
  const snapshot=useCallback(()=>store?reader.current!.read(latest.current):emptySlice,[store]);
  useSyncExternalStore(store?.subscribe??emptySubscribe,snapshot);
  return store?.live??null;
}
export function useUITracked(select:(value:UIContextValue)=>readonly unknown[]):UIContextValue{
  const ui=useOptionalUITracked(select);if(!ui)throw Error('UI subscription provider is not mounted.');return ui;
}
