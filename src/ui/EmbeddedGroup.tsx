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
import { useUI, UIHomeContext, UIContainerContext } from "./context";
import { DockArea } from "./DockArea";
import { useDockHost } from "./DockHost";
import { nextWindowLayer } from "./FloatingWindow";
import { FrameChrome } from "./FrameChrome";
import { containers, type WindowState } from "./layout";
import { nativeActionId } from "./NativeActions";

/** A compact, embedded window uses the same ownership, docking and history as every other window.
 * Its full content remains mounted when collapsed or moved, so actions never turn into stale proxies. */
export function EmbeddedGroup({
  id,
  title,
  expanded,
  selected,
  className = "",
  nodeId,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  expanded: boolean;
  selected?: boolean;
  className?: string;
  nodeId?: string;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  const appearance = useAppearance();
  const ui = useUI(),
    home = useContext(UIHomeContext),
    parent = useContext(UIContainerContext) ?? home,
    key = `window:${id}`;
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
      className={`ui-inline-group ${className}`}
      onMouseDown={(event) => {
        if (!atHome && !host) {
          event.stopPropagation();
          setZ(nextWindowLayer());
        }
      }}
      data-property-node={nodeId}
      data-ui-inline-group={key}
      data-ui-action-ids={JSON.stringify(state.inline?.actionIds ?? {})}
      data-ui-resident-root={key}
      style={
        !atHome && !host
          ? {
              position: "fixed",
              left: Math.max(
                8,
                Math.min(
                  state.x,
                  innerWidth - (root.current?.getBoundingClientRect().width ?? state.width) - 8,
                ),
              ),
              top: Math.max(
                8,
                Math.min(
                  state.y,
                  innerHeight - (root.current?.getBoundingClientRect().height ?? state.height) - 8,
                ),
              ),
              zIndex: z,
              maxHeight: "calc(100vh - 16px)",
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
        <UIContainerContext.Provider value={key}>
          {children}
          <DockArea container={key} contour={false} />
        </UIContainerContext.Provider>
      </div>
    </div>
  );
  if (atHome) return content;
  return createPortal(content, host ?? document.body);
}
