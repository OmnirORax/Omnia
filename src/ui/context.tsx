import { createContext, useContext, type ReactElement } from "react";
import type { UILayout } from "./layout";
export type UIFunction = { id: string; label: string; element: ReactElement; control?: boolean };
export type UIContextValue = {
  layout: UILayout;
  update: (change: (layout: UILayout) => UILayout) => void;
  functions: UIFunction[];
  configure: (id: string | null) => void;
  createFrame: (x: number, y: number) => void;
  library: () => void;
};
export const UIContext = createContext<UIContextValue | null>(null);
export function useUI() {
  const value = useContext(UIContext);
  if (!value) throw new Error("UI workspace is not mounted.");
  return value;
}
