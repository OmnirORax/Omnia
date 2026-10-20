import { useLayoutEffect, useRef } from "react";
import { Rnd } from "react-rnd";
import { useUI } from "./context";
import { DockArea } from "./DockArea";
import { FrameChrome } from "./FrameChrome";
import { useFrameBounds } from "./frameBounds";
import { updateContainer, type WindowState } from "./layout";
import { useOutsideDismiss } from "./useOutsideDismiss";

/** Live, target-owned actions use the workspace's same free/snap arrangement surface.
 * Only presentation is saved; entity IDs and callbacks never enter UI templates. */
export function EntityMenu<T extends string>({
  kind,
  x,
  y,
  items,
  onChoose,
  onDismiss,
  bounds: viewport,
}: {
  kind: string;
  x: number;
  y: number;
  items: [T, string][];
  onChoose: (id: T) => void;
  onDismiss: () => void;
  bounds: { width: number; height: number };
}) {
  const ui = useUI(),
    id = `context:${kind}`,
    key = `window:${id}`,
    { ref, bounds, element } = useFrameBounds(),
    choose = useRef(onChoose);
  useOutsideDismiss(true, () => [element?.closest(".entity-menu") ?? element], onDismiss);
  choose.current = onChoose;
  const signature = JSON.stringify(items);
  useLayoutEffect(() => {
    const cleanups = items.map(([action, label]) =>
      ui.registerFunction({
        id: `${id}:${action}`,
        label,
        category: "Context actions",
        scope: key,
        element: (
          <button role="menuitem" onClick={() => choose.current(action)}>
            {label}
          </button>
        ),
      }),
    );
    const saved = ui.layout.windows[id],
      legacy = ui.layout.menus[kind];
    const state: WindowState = saved ?? {
      x: 0,
      y: 0,
      width: 230,
      height: 400,
      collapsed: false,
      pinned: false,
    };
    const members = items.map(([action]) => {
      const fn = `${id}:${action}`,
        existing = state.members?.find((m) => m.id === fn);
      return (
        existing ?? {
          kind: "function" as const,
          id: fn,
          ...(legacy?.[action]
            ? {
                position: { x: legacy[action].x * 174 + 12, y: legacy[action].y * 46 + 12 },
                size: { width: 160, height: 32 },
              }
            : {}),
        }
      );
    });
    if (JSON.stringify(state.members) !== JSON.stringify(members))
      ui.update((s) => ({ ...s, windows: { ...s.windows, [id]: { ...state, members } } }));
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [kind, signature, ui.registerFunction]);
  const state = ui.layout.windows[id];
  if (!state) return null;
  return (
    <Rnd
      className="entity-menu contour-frame"
      disableDragging
      size={{ width: bounds.width, height: bounds.height }}
      position={{
        x: Math.max(4, Math.min(x, viewport.width - bounds.width - 8)),
        y: Math.max(4, Math.min(y, viewport.height - bounds.height - 8)),
      }}
      enableResizing={{ right: true, bottomRight: true }}
      minWidth={60}
      maxWidth={viewport.width - 16}
      onResizeStop={(_, __, element) =>
        ui.update((s) => updateContainer(s, key, { width: element.offsetWidth }))
      }
    >
      <div
        ref={ref}
        className="ui-frame-root ui-context-menu"
        role="menu"
        aria-label={`${kind} actions`}
        data-ui-resident-root={key}
        style={{ width: state.width, position: "relative", left: -bounds.x, top: -bounds.y }}
      >
        <FrameChrome
          container={key}
          title={`${kind} actions`}
          state={state}
          fixed
          onClose={onDismiss}
          onChange={(patch) => ui.update((s) => updateContainer(s, key, patch))}
        />
        <DockArea container={key} />
      </div>
    </Rnd>
  );
}
