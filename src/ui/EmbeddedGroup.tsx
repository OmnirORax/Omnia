import {functionIndex} from './functionIndex';
import {
  useEffect,
  useContext,
  useLayoutEffect,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useAppearance } from "../appearance/Context";
import { useUITracked, UIHomeContext, UIContainerContext, UIPathContext } from "./context";
import { DockArea } from "./DockArea";
import { useDockHost } from "./DockHost";
import { useWindowLayer } from "./useWindowLayer";
import { FrameChrome } from "./FrameChrome";
import { containers, type WindowState } from "./layout";
import { nativeActionId } from "./NativeActions";
import { useDockResident, useDockWorkspace } from "./DockWorkspace";
import { fitDockRect } from "./docking";
import { keepFloatingHandleVisible } from "./positioning";
import { useContentSize } from "./frameBounds";

/** A compact, embedded window uses the same ownership, docking and history as every other window.
 * Its full content remains mounted when collapsed or moved, so actions never turn into stale proxies. */
export function EmbeddedGroup({
  id,
  title,
  tooltip,
  disabled = false,
  expanded: expandedOverride,
  defaultExpanded = true,
  selected,
  reveal = false,
  className = "",
  nodeId,
  nativeTag,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  tooltip?: string;
  disabled?: boolean;
  expanded?: boolean;
  defaultExpanded?: boolean;
  selected?: boolean;
  /** Transient inspection reveal; never clears the saved closed flag. */
  reveal?: boolean;
  className?: string;
  nodeId?: string;
  nativeTag?: string;
  onToggle?: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  const appearance = useAppearance();
  const ui = useUITracked(ui=>[ui.layout.windows[id],ui.layout.items,ui.layout.labels,functionIndex(ui.functions,ui.layout).owners.get(`window:${id}`),functionIndex(ui.functions,ui.layout).permissions]),
    home = useContext(UIHomeContext),
    parent = useContext(UIContainerContext) ?? home,
    path = useContext(UIPathContext),
    key = `window:${id}`;
  const expanded = expandedOverride ?? !(ui.layout.windows[id]?.collapsed ?? !defaultExpanded);
  const { element: root, ref, size } = useContentSize();
  const [z, raise] = useWindowLayer();
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
  const closed = !!state.closed && !reveal;
  const host = useDockHost(key),
    atHome = !state.inline?.detached;
  const workspace = useDockWorkspace();
  const viewport = { x: 8, y: 8, width: innerWidth-16, height: innerHeight-16 };
  const available = workspace.active ? workspace.floating : viewport;
  const desired = { x: state.x, y: state.y, width: size.width || state.width, height: size.height || state.height };
  const visible = useDockResident(key, state.floatingOverflow ? keepFloatingHandleVisible(desired, viewport, state.chrome?.handle) : fitDockRect(desired, available), !closed && !atHome && !host, state.floatingOverflow);
  useLayoutEffect(() => {
    ui.defaults.set(id, initial);
    return () => {
      ui.defaults.delete(id);
    };
  });
  // Native homes follow shared UI regrouping, while detached/docked placements
  // remain explicitly owned. This keeps bulk branch actions correct after upgrades.
  useLayoutEffect(() => {
    if (!state.inline || state.inline.detached || state.inline.parent === parent ||
        containers(ui.layout).some(([, owner]) => owner.members?.some(member => member.kind === "window" && member.id === id))) return;
    ui.update(layout => {
      const saved = layout.windows[id];
      return saved?.inline && !saved.inline.detached ? { ...layout, windows: { ...layout.windows,
        [id]: { ...saved, inline: { ...saved.inline, parent } },
      } } : layout;
    });
  }, [id, parent, state.inline, ui.update]);
  // Preserve existing customized property icons and recover former button-only moves.
  useEffect(() => {
    if (ui.layout.windows[id]?.inline || !root) return;
    const button = root.querySelector<HTMLButtonElement>("[data-ui-inline-handle]");
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
  }, [id, ui.layout.windows[id], ui.layout.items, root]);
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
      ref={ref}
      hidden={closed}
      className={`ui-inline-group ${className}`}
      onMouseDown={(event) => {
        if (!atHome && !host) {
          event.stopPropagation();
          raise();
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
              // The payload remains naturally sized even when its viewport is
              // temporarily constrained by docking or the screen edges.
              width: "max-content",
              maxWidth: available.width,
              display: "flow-root",
              margin: 0,
            }
          : undefined
      }
    >
      <FrameChrome
        container={key}
        title={title}
        tooltip={tooltip}
        disabled={disabled}
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
  return createPortal(host ? content : <div
    className="ui-floating-group-viewport"
    data-ui-native-tag="transparent"
    data-ui-floating-surface={key}
    hidden={closed}
    style={{ position: "fixed", left: visible.x, top: visible.y, zIndex: z,
      width: visible.width, maxHeight: visible.height, overflow: "auto" }}
  >{content}</div>, host ?? document.body);
}
