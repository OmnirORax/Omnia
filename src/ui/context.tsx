import type { ActiveContextStore, ContextLayer } from "./activeContextModel";
import { createContext, useContext, type ReactElement, type ReactNode } from "react";
import type { UILayout, WindowState, UIResident, FrameLayoutMode } from "./layout";
import type { PlacementPreview } from "./drag";
import type { TransientStore } from "./transientStore";
export type UIFunction = {
  id: string;
  label: string;
  element: ReactElement;
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
