import { createContext, useContext, type ReactElement, type ReactNode } from "react";
import type { UILayout, WindowState, UIResident } from "./layout";
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
};
export type UICommand = { action: "select" | "compact" | "align" | "reset"; sequence: number };
export type UIContextValue = {
  layout: UILayout;
  update: (change: (layout: UILayout) => UILayout) => void;
  functions: UIFunction[];
  shortcutBindings?: Record<string, string>;
  registerFunction: (fn: UIFunction) => () => void;
  configure: (id: string | null) => void;
  configureFrame: (key: string) => void;
  createFrame: (x: number, y: number) => void;
  library: () => void;
  frameMenu: (key: string, x: number, y: number) => void;
  configureControl: (owner: string, control: "collapse" | "pin" | "close") => void;
  anchorTarget: string | null;
  chooseMode: (owner: string, mode: "free" | "snap") => void;
  placementPreview: TransientStore<PlacementPreview | null>;
  defaults: Map<string, WindowState>;
  frameActions: Map<
    string,
    {
      title: string;
      label: string;
      state: Pick<WindowState, "collapsed" | "pinned" | "chrome">;
      onChange: (patch: Partial<WindowState>) => void;
      onRename?: (value: string) => void;
      onClose?: () => void;
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
/** Native anchor identity stays at home while groups use separate container ownership. */
export const UIContainerContext = createContext<string | undefined>(undefined);
export const DockFillContext = createContext(false);
export function useUI() {
  const value = useContext(UIContext);
  if (!value) throw new Error("UI workspace is not mounted.");
  return value;
}
