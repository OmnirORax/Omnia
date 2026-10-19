import { useCallback, useSyncExternalStore, useLayoutEffect, useRef, useState } from "react";
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
export function DockHost({
  id,
  width,
  height,
  collapsed = false,
}: {
  id: string;
  width: number;
  height: number;
  collapsed?: boolean;
}) {
  const root = useRef<HTMLDivElement | null>(null),
    [size, setSize] = useState({ width: 64, height: 56 });
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      root.current = node;
      if (node) hosts.set(id, node);
      else hosts.delete(id);
      listeners.forEach((fn) => fn());
    },
    [id],
  );
  useLayoutEffect(() => {
    const node = root.current;
    if (!node || !collapsed) return;
    const measure = () => {
      const r = node.firstElementChild?.getBoundingClientRect();
      if (r)
        setSize((old) =>
          Math.abs(old.width - r.width) < 0.5 && Math.abs(old.height - r.height) < 0.5
            ? old
            : { width: r.width, height: r.height },
        );
    };
    const resize = new ResizeObserver(measure);
    const observe = () => {
      resize.disconnect();
      if (node.firstElementChild) resize.observe(node.firstElementChild);
      measure();
    };
    const changes = new MutationObserver(observe);
    changes.observe(node, { childList: true });
    observe();
    return () => {
      resize.disconnect();
      changes.disconnect();
    };
  }, [collapsed]);
  return (
    <div
      className={`ui-window-host ${collapsed ? "collapsed-ui-host" : ""}`}
      ref={ref}
      style={{
        width: collapsed ? size.width : width,
        height: collapsed ? size.height : height,
        maxWidth: "100%",
      }}
    />
  );
}
