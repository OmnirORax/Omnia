import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from "react";
import type { ConfigurationGesture, ConfigurationInteraction } from "./configurationGesture";
export const ConfigurationInteractionContext = createContext<{ id: string; gesture: ConfigurationGesture; close: () => void } | null>(null);
/** Renderers supply choices/behavior only; the shared router owns every gesture. */
export function useConfigurationInteraction(interaction: ConfigurationInteraction) {
  const context = useContext(ConfigurationInteractionContext), latest = useRef(interaction); latest.current = interaction;
  useLayoutEffect(() => context?.gesture.register({
    cycle: () => latest.current.cycle(), apply: () => latest.current.apply(),
    select: index => latest.current.select?.(index), lock: () => latest.current.lock?.(), reset: () => latest.current.reset?.(),
  }), [context?.gesture, context?.id]);
  return context;
}
export function ConfigurationInteractionBoundary({ id, gesture, close, children }: { id: string; gesture: ConfigurationGesture; close: () => void; children: ReactNode }) {
  return <ConfigurationInteractionContext.Provider value={{ id, gesture, close }}>
    <div onClickCapture={event => {
      if (!(event.target instanceof Element) || !event.target.closest("[data-configuration-option]")) return;
      event.preventDefault(); event.stopPropagation(); gesture.reset();
    }} onContextMenu={event => {
      const option = (event.target as Element).closest<HTMLElement>("[data-configuration-option],[data-configuration-lock]");
      if (!option) return;
      event.preventDefault(); event.stopPropagation();
      if (option.dataset.configurationOption !== undefined) gesture.select(Number(option.dataset.configurationOption));
      // Secondary shared select choices must take the pointed value before
      // locking, just as the primary configuration options do.
      if (option.dataset.configurationOption === undefined) (event.target as Element).closest<HTMLElement>("[data-property-choice]")?.click();
      gesture.lock(); close();
    }}>{children}</div>
  </ConfigurationInteractionContext.Provider>;
}
