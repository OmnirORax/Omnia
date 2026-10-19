import { createContext, useContext, type ReactElement, type ReactNode } from "react";
import type { UILayout, WindowState, UIResident } from "./layout";
import type { DockPreview } from "./drag";
export type UIFunction = {
  id: string;
  label: string;
  element: ReactElement;
  control?: boolean;
  category?: string;
  available?: boolean;
};
export type UIContextValue = {
  layout: UILayout;
  update: (change: (layout: UILayout) => UILayout) => void;
  functions: UIFunction[];
  registerFunction: (fn: UIFunction) => () => void;
  configure: (id: string | null) => void;
  createFrame: (x: number, y: number) => void;
  library: () => void;
  frameMenu: (key: string, x: number, y: number) => void;
  configureControl: (owner: string, control: "collapse" | "pin" | "close") => void;
  anchorTarget: string | null;
  chooseMode: (owner: string, mode: "free" | "snap") => void;
  preview: DockPreview | null;
  defaults: Map<string, WindowState>;
  renderResident: (member: UIResident) => ReactNode;
};
export const UIContext = createContext<UIContextValue | null>(null);
export const UIHomeContext = createContext("workspace");
export function useUI() {
  const value = useContext(UIContext);
  if (!value) throw new Error("UI workspace is not mounted.");
  return value;
}
