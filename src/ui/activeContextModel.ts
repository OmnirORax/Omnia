import type { TransientStore } from "./transientStore.ts";
export type ActiveContextEntry = { kind: "frame"; key: string; element?: HTMLElement } |
  { kind: "field" | "layer"; element: HTMLElement };
export type ActiveContextStack = readonly ActiveContextEntry[];
export type ActiveContextStore = TransientStore<ActiveContextStack>;
export type ContextLayer = { parent?: string; close: () => void };
export const UI_CANCEL_EDIT = "omnium:cancel-value-edit";
/** One level only, even when the same physical key repeats. */
export const parentContext = (stack: ActiveContextStack): ActiveContextStack => stack.slice(0, -1);
export const activeFrame = (stack: ActiveContextStack) => [...stack].reverse().find((entry): entry is Extract<ActiveContextEntry, { kind: "frame" }> => entry.kind === "frame");
