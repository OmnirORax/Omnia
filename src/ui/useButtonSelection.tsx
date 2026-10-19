import { useEffect, useRef, useState } from "react";
import {
  canDock,
  contextOwner,
  functionPinned,
  getContainer,
  ownerOf,
  residentKey,
  residentPinned,
  type UILayout,
  type UIResident,
} from "./layout";
import type { UICommand, UIFunction } from "./context";
import {
  buttonBounds,
  compactButtons,
  intersects,
  placeButtons,
  type ButtonBox,
} from "./selection";
import { snapPosition, snapshotPositions, type PositionedBox } from "./positioning";
import { rectDistance } from "./drag";
import { residentBounds } from "./frameBounds";

const selectable = "button[data-ui-function]:not([data-ui-palette])";
const boxOf = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
};
const visible = (el: HTMLElement) =>
  !!el.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
const buttons = () => [...document.querySelectorAll<HTMLElement>(selectable)].filter(visible);
const zoneFor = (owner: string) =>
  [...document.querySelectorAll<HTMLElement>("[data-ui-drop-zone]")].find(
    (el) => el.dataset.uiDropZone === owner && visible(el),
  );
const toLocal = (b: PositionedBox, zone: HTMLElement): PositionedBox => {
  const r = zone.getBoundingClientRect();
  return {
    ...b,
    x: b.x - r.x + Number(zone.dataset.originX || 0) + zone.scrollLeft,
    y: b.y - r.y + Number(zone.dataset.originY || 0) + zone.scrollTop,
  };
};
const baselineOf = (layout: UILayout, target: string, zone: HTMLElement) =>
  snapshotPositions(
    getContainer(layout, target)?.members ?? [],
    new Map(
      [...zone.querySelectorAll<HTMLElement>(":scope > [data-ui-slot-key]")].map((el) => [
        el.dataset.uiSlotKey!,
        toLocal(boxOf(el), zone),
      ]),
    ),
    residentKey,
  );
type Proposal = {
  boxes: ButtonBox[];
  preview: ButtonBox[];
  target?: string;
  baseline?: UIResident[];
  message: string;
};
type Gesture = {
  start: { x: number; y: number };
  boxes: ButtonBox[];
  bounds: PositionedBox;
  moved: boolean;
  proposal?: Proposal;
  marquee?: boolean;
  additive?: boolean;
  scope?: string;
  initial: Set<string>;
  clickId?: string;
};

export function useButtonSelection({
  layout,
  update,
  functions,
  command,
  suppress,
}: {
  layout: UILayout;
  update: (f: (s: UILayout) => UILayout) => void;
  functions: UIFunction[];
  command?: UICommand | null;
  suppress: () => void;
}) {
  const [ids, setIds] = useState<Set<string>>(() => new Set()),
    [mode, setMode] = useState(false),
    [rectangle, setRectangle] = useState<PositionedBox | null>(null),
    [previews, setPreviews] = useState<ButtonBox[]>([]),
    [message, setMessage] = useState(""),
    [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const current = useRef({ layout, update, functions, ids, mode });
  current.current = { layout, update, functions, ids, mode };
  const gesture = useRef<Gesture | null>(null);
  const select = (next: Set<string>) => {
    current.current.ids = next;
    setIds(next);
  };
  const clear = () => {
    select(new Set());
    setMode(false);
    setMenu(null);
    setMessage("");
  };
  const editable = (el: HTMLElement) =>
    !functionPinned(current.current.layout, el.dataset.uiFunction!) &&
    !residentPinned(
      current.current.layout,
      el.closest<HTMLElement>("[data-ui-resident-root]")?.dataset.uiResidentRoot ?? "",
    );
  const selectedBoxes = () =>
    buttons()
      .filter((el) => current.current.ids.has(el.dataset.uiFunction!))
      .map((el) => ({ id: el.dataset.uiFunction!, ...boxOf(el) }));
  const obstacles = (excluded: Set<string>, target?: string): PositionedBox[] => {
    if (target) {
      const zone = zoneFor(target);
      return zone
        ? [...zone.querySelectorAll<HTMLElement>(":scope > [data-ui-slot-key]")]
            .filter(
              (el) => !excluded.has(el.dataset.uiSlotKey!.replace(/^function:/, "")) && visible(el),
            )
            .map((el) => boxOf(el))
        : [];
    }
    return [
      ...document.querySelectorAll<HTMLElement>(
        "[data-ui-function]:not([data-ui-palette]),[data-ui-resident-root]",
      ),
    ]
      .filter(
        (el) =>
          visible(el) &&
          !excluded.has(el.dataset.uiFunction ?? "") &&
          !el.closest(".ui-selection-tools,.ui-background-menu") &&
          !(
            el.dataset.uiResidentRoot && ownerOf(current.current.layout, el.dataset.uiResidentRoot)
          ),
      )
      .map((el) => (el.dataset.uiResidentRoot ? residentBounds(el) : boxOf(el)));
  };
  const compact = () => {
    try {
      const state = current.current,
        all = selectedBoxes();
      if (all.length < 2) {
        setMessage("Select at least two UI buttons to compact.");
        return;
      }
      const groups = new Map<string | undefined, ButtonBox[]>();
      for (const b of all) {
        const owner = ownerOf(state.layout, `function:${b.id}`);
        groups.set(owner, [...(groups.get(owner) ?? []), b]);
      }
      let next = state.layout;
      for (const [owner, group] of groups) {
        if (group.length < 2) continue;
        const zone = owner ? zoneFor(owner) : undefined;
        if (owner && !zone) throw new Error("Expand this frame before compacting its buttons.");
        const excluded = new Set(group.map((b) => b.id)),
          occupied = obstacles(excluded, owner);
        const r = zone?.getBoundingClientRect(),
          ox = Number(zone?.dataset.originX || 0),
          oy = Number(zone?.dataset.originY || 0);
        const local = zone ? group.map((b) => ({ ...b, ...toLocal(b, zone) })) : group;
        const area = zone
          ? {
              x: ox,
              y: oy,
              width: Math.max(
                60,
                Math.min(
                  getContainer(next, owner!)?.width ?? r!.width,
                  window.innerWidth - r!.x - 12,
                ),
              ),
              height: Math.max(60, window.innerHeight - r!.y - 12),
            }
          : { x: 8, y: 8, width: window.innerWidth - 16, height: window.innerHeight - 16 };
        const packed = compactButtons(
          local,
          zone ? occupied.map((b) => toLocal(b, zone)) : occupied,
          area,
        );
        next = placeButtons(next, packed, owner, zone ? baselineOf(next, owner!, zone) : undefined);
      }
      state.update(() => next);
      setMenu(null);
      setMessage("Selected UI compacted. Shift+MB4 undoes it.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };
  const resolve = (g: Gesture, x: number, y: number): Proposal => {
    const state = current.current,
      excluded = new Set(g.boxes.map((b) => b.id));
    const elements = document
      .elementsFromPoint(x, y)
      .filter(
        (el) =>
          !excluded.has(el.closest<HTMLElement>("[data-ui-function]")?.dataset.uiFunction ?? ""),
      );
    const handle = elements.map((el) => el.closest<HTMLElement>(".ui-frame-handle")).find(Boolean),
      handleKey = handle?.closest<HTMLElement>("[data-ui-chrome]")?.dataset.uiChrome;
    let target = handleKey,
      zone = target ? zoneFor(target) : undefined;
    if (!target) {
      zone = elements
        .map((el) => el.closest<HTMLElement>("[data-ui-drop-zone]"))
        .find((el): el is HTMLElement => !!el);
      target = zone?.dataset.uiDropZone;
    }
    if (!target) {
      const owners = new Set(g.boxes.map((b) => ownerOf(state.layout, `function:${b.id}`)));
      if (owners.size === 1 && [...owners][0]) {
        const own = zoneFor([...owners][0]!);
        if (own && rectDistance(x, y, own.getBoundingClientRect()) <= 24) {
          zone = own;
          target = own.dataset.uiDropZone;
        }
      }
    }
    if (
      target &&
      (!zone || g.boxes.some((b) => !canDock(state.layout, `function:${b.id}`, target!)))
    )
      return {
        boxes: [],
        preview: [],
        message: !zone
          ? "Expand this frame to place multiple buttons."
          : "Unpin the target, or keep these actions in their owning menu.",
      };
    if (!target && g.boxes.some((b) => contextOwner(`function:${b.id}`)))
      return { boxes: [], preview: [], message: "These actions stay in their context menu." };
    let desired = { x: g.bounds.x + x - g.start.x, y: g.bounds.y + y - g.start.y };
    const occupied = obstacles(excluded, target),
      container = target ? getContainer(state.layout, target) : undefined;
    const arrangement = container?.arrangement ?? (!target ? state.layout.arrangement : undefined);
    if (zone) {
      desired = toLocal({ ...desired, width: 0, height: 0 }, zone);
      if (handleKey === target) {
        const existing = (container?.members ?? []).filter((m) => !excluded.has(m.id));
        desired = {
          x: 12,
          y: Math.max(
            12,
            ...existing.map((m) => (m.position?.y ?? 0) + (m.size?.height ?? 40) + 12),
          ),
        };
      }
      if (arrangement?.mode === "snap" && arrangement.grid)
        desired = snapPosition(
          desired,
          g.bounds,
          arrangement.grid,
          occupied.map((b) => toLocal(b, zone!)),
        );
    } else {
      if (g.bounds.width > window.innerWidth - 16 || g.bounds.height > window.innerHeight - 16)
        return {
          boxes: [],
          preview: [],
          message: "Compact the selection first so it fits in the workspace.",
        };
      desired = {
        x: Math.max(8, Math.min(desired.x, window.innerWidth - g.bounds.width - 8)),
        y: Math.max(8, Math.min(desired.y, window.innerHeight - g.bounds.height - 8)),
      };
      if (arrangement?.mode === "snap" && arrangement.grid)
        desired = snapPosition(desired, g.bounds, arrangement.grid, occupied);
    }
    const placed = g.boxes.map((b) => ({
      ...b,
      x: desired.x + b.x - g.bounds.x,
      y: desired.y + b.y - g.bounds.y,
    }));
    const r = zone?.getBoundingClientRect(),
      preview = zone
        ? placed.map((b) => ({
            ...b,
            x: b.x + r!.x - Number(zone.dataset.originX || 0) - zone.scrollLeft,
            y: b.y + r!.y - Number(zone.dataset.originY || 0) - zone.scrollTop,
          }))
        : placed;
    return {
      boxes: placed,
      preview,
      target,
      baseline: zone ? baselineOf(state.layout, target!, zone) : undefined,
      message: `Move ${placed.length} UI buttons ${target ? "into this frame" : "together"}${arrangement?.mode === "snap" ? " · snap" : ""}`,
    };
  };
  const ops = useRef({ compact, clear, resolve });
  ops.current = { compact, clear, resolve };
  useEffect(() => {
    if (command?.action === "select") {
      setMode((v) => !v);
      setMenu(null);
    } else if (command?.action === "compact") ops.current.compact();
  }, [command?.sequence]);
  useEffect(() => {
    document.body.classList.toggle("ui-select-mode", mode);
    return () => document.body.classList.remove("ui-select-mode");
  }, [mode]);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (e.button !== 0) {
        if (gesture.current && (e.button === 3 || e.button === 4)) cancel();
        return;
      }
      const target = e.target as Element,
        state = current.current;
      if (
        target.closest(
          "input,textarea,select,[contenteditable=true],.ui-selection-tools,.ui-background-menu,.ui-field-edge",
        )
      )
        return;
      const button = target.closest<HTMLElement>(selectable),
        id = button?.dataset.uiFunction,
        additive = e.ctrlKey || e.metaKey;
      if (id && (!["ui:select", "ui:compact"].includes(id) || additive || (state.ids.size > 1 && state.ids.has(id)))) {
        if (!state.mode && !additive && !(state.ids.size > 1 && state.ids.has(id))) {
          if (state.ids.size) select(new Set());
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        suppress();
        setMenu(null);
        if (!editable(button!)) {
          setMessage("Unpin the button or its frame before selecting it.");
          return;
        }
        const scope = contextOwner(`function:${id}`),
          scopes = new Set([...state.ids].map((key) => contextOwner(`function:${key}`)));
        if (additive && state.ids.size && (!scopes.has(scope) || scopes.size > 1)) {
          setMessage("Context-menu actions must be selected separately from other UI.");
          return;
        }
        if (additive) {
          const next = new Set(state.ids);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          select(next);
          return;
        }
        const next = state.ids.has(id) ? state.ids : new Set([id]);
        select(next);
        const boxes = buttons()
          .filter((el) => next.has(el.dataset.uiFunction!))
          .map((el) => ({ id: el.dataset.uiFunction!, ...boxOf(el) }));
        gesture.current = {
          start: { x: e.clientX, y: e.clientY },
          boxes,
          bounds: buttonBounds(boxes),
          moved: false,
          initial: new Set(next),
          clickId: id,
        };
      } else if (
        (state.mode || (additive && target.closest("[data-ui-resident-root],.toolbar"))) &&
        !target.closest("button,a,[data-ui-drag],.window-resize-grip")
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        suppress();
        const scope = target.closest<HTMLElement>("[data-ui-drop-zone]")?.dataset.uiDropZone;
        gesture.current = {
          start: { x: e.clientX, y: e.clientY },
          boxes: [],
          bounds: { x: 0, y: 0, width: 0, height: 0 },
          moved: false,
          marquee: true,
          additive,
          scope: scope?.startsWith("window:context:") ? scope : undefined,
          initial: new Set(additive ? state.ids : []),
        };
        setRectangle({ x: e.clientX, y: e.clientY, width: 0, height: 0 });
        setMenu(null);
      }
    };
    const move = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      g.moved ||= Math.hypot(e.clientX - g.start.x, e.clientY - g.start.y) > 5;
      if (g.marquee) {
        const rect = {
          x: Math.min(g.start.x, e.clientX),
          y: Math.min(g.start.y, e.clientY),
          width: Math.abs(e.clientX - g.start.x),
          height: Math.abs(e.clientY - g.start.y),
        };
        setRectangle(rect);
        const next = new Set(g.initial);
        for (const b of buttons())
          if (
            editable(b) &&
            contextOwner(`function:${b.dataset.uiFunction}`) === g.scope &&
            intersects(rect, boxOf(b))
          )
            next.add(b.dataset.uiFunction!);
        select(next);
      } else if (g.moved) {
        try {
          g.proposal = ops.current.resolve(g, e.clientX, e.clientY);
          setPreviews(g.proposal.preview);
          setMessage(g.proposal.message);
        } catch (error) {
          g.proposal = undefined;
          setPreviews([]);
          setMessage(error instanceof Error ? error.message : String(error));
        }
      }
    };
    const up = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      suppress();
      gesture.current = null;
      setRectangle(null);
      setPreviews([]);
      if (!g.marquee && g.moved && g.proposal?.boxes.length) {
        const proposal = g.proposal;
        current.current.update((s) =>
          placeButtons(s, proposal.boxes, proposal.target, proposal.baseline),
        );
        setMessage("UI selection moved. Shift+MB4 undoes it.");
      }
    };
    const cancel = () => {
      if (!gesture.current) return;
      gesture.current = null;
      setRectangle(null);
      setPreviews([]);
      suppress();
      setMessage("Move cancelled.");
    };
    const key = (e: KeyboardEvent) => {
      const active = gesture.current || current.current.ids.size || current.current.mode;
      if (
        active &&
        ["Delete", "Backspace"].includes(e.key) &&
        !(
          e.target instanceof HTMLElement &&
          (e.target.isContentEditable || e.target.matches("input,textarea,select"))
        )
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setMessage(
          "UI buttons are selected; graph knowledge is unchanged. Use a function’s settings to remove it.",
        );
        return;
      }
      if (e.key === "Escape" && active) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (gesture.current) cancel();
        else ops.current.clear();
      }
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", cancel, true);
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", cancel, true);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", key, true);
    };
  }, [suppress]);
  return {
    ids,
    mode,
    rectangle,
    previews,
    message,
    menu,
    compact,
    clear,
    openMenu: (x: number, y: number) => setMenu({ x, y }),
  };
}
export function ButtonSelectionOverlay({
  selection,
}: {
  selection: ReturnType<typeof useButtonSelection>;
}) {
  return (
    <>
      {selection.rectangle && (
        <div
          className="ui-selection-rectangle"
          style={{
            left: selection.rectangle.x,
            top: selection.rectangle.y,
            width: selection.rectangle.width,
            height: selection.rectangle.height,
          }}
        />
      )}
      {selection.previews.map((b) => (
        <div
          key={b.id}
          className="ui-placement-preview"
          style={{ left: b.x, top: b.y, width: b.width, height: b.height }}
        />
      ))}
      {(selection.mode || selection.ids.size > 0) && (
        <div className="ui-selection-tools" role="region" aria-label="UI selection">
          <span>{selection.ids.size} UI selected</span>
          <button disabled={selection.ids.size < 2} onClick={selection.compact}>
            Compact UI
          </button>
          <button onClick={selection.clear}>Done / clear</button>
          <small>
            Ctrl/Cmd-click to add · drag selected buttons together
            {selection.mode ? " · drag a box to select" : ""}
          </small>
        </div>
      )}
      {selection.message && (
        <div className="ui-selection-message" role="status">
          {selection.message}
        </div>
      )}
      {selection.menu && (
        <div
          className="ui-background-menu ui-selection-tools"
          role="menu"
          aria-label="Selected UI actions"
          style={{
            left: Math.max(8, Math.min(selection.menu.x, window.innerWidth - 240)),
            top: Math.max(8, Math.min(selection.menu.y, window.innerHeight - 120)),
          }}
        >
          <button onClick={selection.compact}>Compact selected UI</button>
          <button onClick={selection.clear}>Clear UI selection</button>
        </div>
      )}
    </>
  );
}
