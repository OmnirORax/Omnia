import {
  useEffect,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useAppearance } from "../appearance/Context";
import { useUI, UIHomeContext, UIContainerContext, UIPathContext } from "./context";
import { DockArea } from "./DockArea";
import { useDockHost } from "./DockHost";
import { nextWindowLayer } from "./FloatingWindow";
import { FrameChrome } from "./FrameChrome";
import { containers, type WindowState } from "./layout";
import { nativeActionId } from "./NativeActions";
import { useDockResident, useDockWorkspace } from "./DockWorkspace";
import { fitDockRect } from "./docking";
import { keepFloatingHandleVisible } from "./positioning";

/** A compact, embedded window uses the same ownership, docking and history as every other window.
 * Its full content remains mounted when collapsed or moved, so actions never turn into stale proxies. */
export function EmbeddedGroup({
  id,
  title,
  expanded: expandedOverride,
  defaultExpanded = true,
  selected,
  className = "",
  nodeId,
  nativeTag,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  expanded?: boolean;
  defaultExpanded?: boolean;
  selected?: boolean;
  className?: string;
  nodeId?: string;
  nativeTag?: string;
  onToggle?: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  const appearance = useAppearance();
  const ui = useUI(),
    home = useContext(UIHomeContext),
    parent = useContext(UIContainerContext) ?? home,
    path = useContext(UIPathContext),
    key = `window:${id}`;
  const expanded = expandedOverride ?? !(ui.layout.windows[id]?.collapsed ?? !defaultExpanded);
  const root = useRef<HTMLDivElement>(null);
  const [z, setZ] = useState(nextWindowLayer);
  const initial: WindowState = {
    x: 120,
    y: 140,
    width: 240,
    height: 160,
    collapsed: !expanded,
    pinned: false,
    inline: { parent },
  };
  const state = ui.layout.windows[id] ?? initial;
  const host = useDockHost(key),
    atHome = !state.inline?.detached;
  const workspace = useDockWorkspace();
  const viewport = { x: 8, y: 8, width: innerWidth-16, height: innerHeight-16 };
  const available = workspace.active ? workspace.floating : viewport;
  const desired = { x: state.x, y: state.y, width: root.current?.getBoundingClientRect().width || state.width, height: root.current?.getBoundingClientRect().height || state.height };
  const visible = useDockResident(key, state.floatingOverflow ? keepFloatingHandleVisible(desired, viewport, state.chrome?.handle) : fitDockRect(desired, available), !state.closed && !atHome && !host, state.floatingOverflow);
  useLayoutEffect(() => {
    ui.defaults.set(id, initial);
    return () => {
      ui.defaults.delete(id);
    };
  });
  // Preserve existing customized property icons and recover former button-only moves.
  useEffect(() => {
    if (ui.layout.windows[id]?.inline || !root.current) return;
    const button = root.current.querySelector<HTMLButtonElement>("[data-ui-inline-handle]");
    if (!button) return;
    const legacy = nativeActionId(button),
      item = ui.layout.items[legacy];
    const refined =
      appearance &&
      Object.values(appearance.state.instances).some(
        (instance) => instance.owner === `function:${legacy}`,
      );
    if (!item && !refined) return;
    const moved = !!item && (!item.home || !!item.anchorId);
    ui.update((previous) => {
      let next = {
        ...previous,
        windows: { ...Object.fromEntries(ui.defaults), ...previous.windows },
      };
      const window = next.windows[id];
      next.windows[id] = {
        ...window,
        ...(item?.style ? { chrome: { ...window.chrome, style: item.style } } : {}),
        inline: { parent, detached: moved, handleId: legacy },
      };
      if (moved && item) {
        next = {
          ...next,
          items: { ...next.items, [legacy]: { ...item, home: true, anchorId: undefined } },
        };
        let found = false;
        for (const [owner, container] of containers(next))
          if (container.members?.some((m) => m.kind === "function" && m.id === legacy)) {
            found = true;
            const members = container.members.map((member) =>
              member.kind === "function" && member.id === legacy
                ? { ...member, kind: "window" as const, id }
                : member,
            );
            next = owner.startsWith("window:")
              ? {
                  ...next,
                  windows: {
                    ...next.windows,
                    [owner.slice(7)]: { ...next.windows[owner.slice(7)], members },
                  },
                }
              : {
                  ...next,
                  frames: next.frames.map((frame) =>
                    `frame:${frame.id}` === owner ? { ...frame, members } : frame,
                  ),
                };
          }
        if (!found) next.windows[id] = { ...next.windows[id], x: item.x, y: item.y };
      }
      return next;
    });
  }, [id, ui.layout.windows[id], ui.layout.items]);
  const patch = (value: Partial<WindowState>) =>
    ui.update((layout) => ({
      ...layout,
      windows: {
        ...Object.fromEntries(ui.defaults),
        ...layout.windows,
        [id]: { ...state, ...value },
      },
    }));
  const content = (
    <div
      ref={root}
      hidden={state.closed}
      className={`ui-inline-group ${className}`}
      onMouseDown={(event) => {
        if (!atHome && !host) {
          event.stopPropagation();
          setZ(nextWindowLayer());
        }
      }}
      data-property-node={nodeId}
      data-ui-native-tag={nativeTag}
      data-ui-inline-group={key}
      data-ui-action-ids={JSON.stringify(state.inline?.actionIds ?? {})}
      data-ui-resident-root={key}
      style={
        !atHome && !host
          ? {
              position: "fixed",
              left: visible.x,
              top: visible.y,
              zIndex: z,
              maxHeight: visible.height,
              maxWidth: visible.width,
              overflow: "auto",
            }
          : undefined
      }
    >
      <FrameChrome
        container={key}
        title={title}
        state={{ ...state, collapsed: !expanded }}
        onChange={patch}
        inline
        legacyHandleId={state.inline?.handleId}
        selected={selected}
        onToggle={onToggle}
      />
      <div className="property-node-contents" hidden={!expanded}>
        <UIPathContext.Provider value={[...path, key]}><UIContainerContext.Provider value={key}>
          {children}
          <DockArea container={key} contour={false} />
        </UIContainerContext.Provider></UIPathContext.Provider>
      </div>
    </div>
  );
  if (atHome) return content;
  return createPortal(content, host ?? document.body);
}
