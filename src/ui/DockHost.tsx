import { useCallback, useSyncExternalStore } from "react";
const hosts = new Map<string, HTMLElement>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function useDockHost(key: string) {
  return useSyncExternalStore(
    subscribe,
    () => hosts.get(key),
    () => undefined,
  );
}
export function DockHost({ id, width, height }: { id: string; width: number; height: number }) {
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) hosts.set(id, node);
      else hosts.delete(id);
      listeners.forEach((fn) => fn());
    },
    [id],
  );
  return <div className="ui-window-host" ref={ref} style={{ width, height, maxWidth: "100%" }} />;
}
