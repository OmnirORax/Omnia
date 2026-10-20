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
  autoSize = false,
  fill = false,
}: {
  id: string;
  width: number;
  height: number;
  collapsed?: boolean;
  autoSize?: boolean;
  fill?: boolean;
}) {
  const root = useRef<HTMLDivElement | null>(null),
    [size, setSize] = useState({ width: 64, height: 56 }),
    [missing, setMissing] = useState(false);
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
    if (!node || (!fill && !collapsed && !autoSize)) return;
    const measure = () => {
      const child = node.querySelector<HTMLElement>(":scope > :not([data-ui-missing])");
      setMissing(!child);
      const r = !fill && child?.getBoundingClientRect();
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
      const child = node.querySelector(":scope > :not([data-ui-missing])");
      if (child && !fill) resize.observe(child);
      measure();
    };
    const changes = new MutationObserver(observe);
    changes.observe(node, { childList: true });
    observe();
    return () => {
      resize.disconnect();
      changes.disconnect();
    };
  }, [collapsed, autoSize, fill]);
  return (
    <div
      className={`ui-window-host ${collapsed ? "collapsed-ui-host" : ""} ${fill ? "ui-dock-fill" : ""}`}
      ref={ref}
      style={{
        width: fill ? "100%" : autoSize ? "max-content" : collapsed ? size.width : width,
        height: fill ? "100%" : autoSize ? "auto" : collapsed ? size.height : height,
        maxWidth: "100%",
      }}
    >
      {(autoSize || fill) && missing && (
        <span data-ui-missing className="ui-missing-group">
          Open the original window to use this group.
        </span>
      )}
    </div>
  );
}
