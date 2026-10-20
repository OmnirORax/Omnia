import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createTransientStore } from "./transientStore";
import {
  canDock,
  getContainer,
  groupResidents,
  ownerOf,
  residentContextScope,
  residentKey,
  residentPinned,
  type UILayout,
  type UIResident,
} from "./layout";
import type { UICommand, UIFunction } from "./context";
import {
  buttonBounds,
  alignButtons,
  compactButtons,
  intersects,
  nearestButtonEdge,
  placeButtons,
  selectionId,
  selectionResident,
  type AlignmentEdge,
  type ButtonBox,
} from "./selection";
import { snapPosition, snapshotPositions, type PositionedBox } from "./positioning";
import { captureUIPointer, rectDistance } from "./drag";
import { residentBounds } from "./frameBounds";
import { useOutsideDismiss } from "./useOutsideDismiss";
import { ContextMenu } from "./ContextMenu";

const selectable = '[data-ui-function]:not([data-ui-palette]),[data-ui-drag^="window:"],[data-ui-drag^="frame:"]';
const idOf = (el: HTMLElement) => el.dataset.uiDrag && /^(window|frame):/.test(el.dataset.uiDrag) ? el.dataset.uiDrag : el.dataset.uiFunction!;
const boxOf = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
};
const visible = (el: HTMLElement) =>
  !!el.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
const buttons = () => [...new Map([...document.querySelectorAll<HTMLElement>(selectable)].filter(visible).map(el => [idOf(el), el])).values()];
const selectionBox = (el: HTMLElement) => {
  const key = selectionResident(idOf(el));
  const root = !key.startsWith("function:") && [...document.querySelectorAll<HTMLElement>('[data-ui-resident-root]')].find(root => root.dataset.uiResidentRoot === key && visible(root));
  const rect = root ? residentBounds(root) : boxOf(el);
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
};
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
  align?: boolean;
  pointerId?: number;
  release?: () => void;
};
type AlignmentPreview = {
  target: ButtonBox;
  edge: AlignmentEdge;
  boxes: ButtonBox[];
  next?: UILayout;
  message: string;
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
    [aligning, setAligning] = useState(false),
    [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [visuals] = useState(() => createTransientStore({
    alignment: null as AlignmentPreview | null,
    rectangle: null as PositionedBox | null,
    previews: [] as ButtonBox[],
    message: "",
  }));
  const setAlignment = (alignment: AlignmentPreview | null) => visuals.set({ ...visuals.getSnapshot(), alignment });
  const setRectangle = (rectangle: PositionedBox | null) => visuals.set({ ...visuals.getSnapshot(), rectangle });
  const setPreviews = (previews: ButtonBox[]) => visuals.set({ ...visuals.getSnapshot(), previews });
  const setMessage = (message: string) => {
    if (message !== visuals.getSnapshot().message) visuals.set({ ...visuals.getSnapshot(), message });
  };
  const current = useRef({ layout, update, functions, ids, mode, aligning });
  current.current = { layout, update, functions, ids, mode, aligning };
  const gesture = useRef<Gesture | null>(null);
  const select = (next: Set<string>) => {
    next = new Set([...next].filter(id => {
      let parent = ownerOf(current.current.layout, selectionResident(id));
      while (parent) { if (next.has(selectionId(parent))) return false; parent = ownerOf(current.current.layout, parent); }
      return true;
    }));
    if (next.size === current.current.ids.size && [...next].every((id) => current.current.ids.has(id))) return;
    current.current.ids = next;
    setIds(next);
  };
  const clear = () => {
    const active = gesture.current;
    gesture.current = null;
    active?.release?.();
    select(new Set());
    setMode(false);
    current.current.aligning = false;
    setAligning(false);
    setAlignment(null);
    setPreviews([]);
    setMenu(null);
    setMessage("");
  };
  const editable = (el: HTMLElement) =>
    !residentPinned(current.current.layout, selectionResident(idOf(el))) &&
    !residentPinned(
      current.current.layout,
      el.closest<HTMLElement>("[data-ui-resident-root]")?.dataset.uiResidentRoot ?? "",
    );
  const selectedBoxes = () =>
    buttons()
      .filter((el) => current.current.ids.has(idOf(el)))
      .map((el) => ({ id: idOf(el), ...selectionBox(el) }));
  const group = () => {
    try {
      const boxes = selectedBoxes();
      if (boxes.length < 2) throw new Error("Select at least two UI items to group.");
      const bounds = buttonBounds(boxes);
      const next = groupResidents(current.current.layout, boxes.map(box => selectionResident(box.id)), bounds.x, bounds.y);
      current.current.update(() => next);
      select(new Set()); setMenu(null);
      setMessage("Selection grouped in a frame. Shift+MB4 undoes it.");
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  };
  const obstacles = (excluded: Set<string>, target?: string): PositionedBox[] => {
    if (target) {
      const zone = zoneFor(target);
      return zone
        ? [...zone.querySelectorAll<HTMLElement>(":scope > [data-ui-slot-key]")]
            .filter(
              (el) => !excluded.has(selectionId(el.dataset.uiSlotKey!)) && visible(el),
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
          !excluded.has(el.dataset.uiResidentRoot ?? idOf(el)) &&
          !el.closest(".ui-selection-tools,.ui-background-menu") &&
          !(
            el.dataset.uiResidentRoot && ownerOf(current.current.layout, el.dataset.uiResidentRoot)
          ),
      )
      .map((el) => (el.dataset.uiResidentRoot ? residentBounds(el) : boxOf(el)));
  };
  const compact = () => {
    current.current.aligning = false;
    setAligning(false);
    setAlignment(null);
    setPreviews([]);
    try {
      const state = current.current,
        all = selectedBoxes();
      if (all.length < 2) {
        setMessage("Select at least two UI items to compact.");
        return;
      }
      const groups = new Map<string | undefined, ButtonBox[]>();
      for (const b of all) {
        const owner = ownerOf(state.layout, selectionResident(b.id));
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
  const align = () => {
    if (!selectedBoxes().length) {
      setMessage("Select the UI items to align first.");
      return;
    }
    const active = !current.current.aligning;
    current.current.aligning = active;
    setAligning(active);
    setAlignment(null);
    setPreviews([]);
    setMenu(null);
    setMessage(active ? "Click another button’s left, right, top or bottom boundary to align. Esc cancels." : "Alignment cancelled.");
  };
  const alignmentFor = (element: Element, x: number, y: number): AlignmentPreview | null => {
    const el = element.closest<HTMLElement>(selectable);
    if (!el || !visible(el) || current.current.ids.has(idOf(el))) return null;
    const target = { id: idOf(el), ...selectionBox(el) };
    const edge = nearestButtonEdge(target, x, y);
    const all = alignButtons(selectedBoxes(), target, edge);
    const result: AlignmentPreview = {
      target, edge, boxes: all,
      message: `Align ${all.length} UI item${all.length === 1 ? "" : "s"} to this ${edge} edge.`,
    };
    try {
      if (!all.length) throw new Error("Select the UI items to align first.");
      for (let i = 0; i < all.length; i++) {
        if (all.slice(i + 1).some(b => intersects(all[i], b)))
          throw new Error("These buttons would overlap. Spread them along the other axis first.");
        if (intersects(all[i], target))
          throw new Error("This alignment would overlap the target button. Choose another edge or move the selection first.");
      }
      const state = current.current;
      const excluded = new Set(all.map(b => b.id));
      const groups = new Map<string | undefined, ButtonBox[]>();
      for (const b of all) {
        const owner = ownerOf(state.layout, selectionResident(b.id));
        groups.set(owner, [...(groups.get(owner) ?? []), b]);
      }
      let next = state.layout;
      for (const [owner, group] of groups) {
        const zone = owner ? zoneFor(owner) : undefined;
        if (owner && !zone) throw new Error("Expand the selected items’ frame before aligning.");
        const occupied = obstacles(excluded, owner);
        if (group.some(b => occupied.some(other => intersects(b, other))))
          throw new Error("This alignment would overlap another UI control. Choose another edge or move the selection first.");
        const local = zone ? group.map(b => ({ ...b, ...toLocal(b, zone) })) : group;
        if (!zone && local.some(b => b.x < 0 || b.y < 0 || b.x + b.width > window.innerWidth || b.y + b.height > window.innerHeight))
          throw new Error("This alignment would move a button outside the workspace.");
        next = placeButtons(next, local, owner, zone ? baselineOf(next, owner!, zone) : undefined);
      }
      result.next = next;
    } catch (error) {
      result.message = error instanceof Error ? error.message : String(error);
    }
    return result;
  };
  const previewAlignment = (element: Element, x: number, y: number) => {
    const result = alignmentFor(element, x, y);
    setAlignment(result);
    setPreviews(result?.boxes ?? []);
    setMessage(result?.message ?? "Click an unselected button’s boundary. Esc cancels alignment.");
    return result;
  };
  const resolve = (g: Gesture, x: number, y: number): Proposal => {
    const state = current.current,
      excluded = new Set(g.boxes.map((b) => b.id));
    const elements = document
      .elementsFromPoint(x, y)
      .filter(
        (el) =>
          !excluded.has(el.closest<HTMLElement>(selectable) ? idOf(el.closest<HTMLElement>(selectable)!) : ""),
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
      const owners = new Set(g.boxes.map((b) => ownerOf(state.layout, selectionResident(b.id))));
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
      (!zone || g.boxes.some((b) => !canDock(state.layout, selectionResident(b.id), target!)))
    )
      return {
        boxes: [],
        preview: [],
        message: !zone
          ? "Expand this frame to place multiple buttons."
          : "Unpin the target, or keep these actions in their owning menu.",
      };
    if (!target && g.boxes.some((b) => residentContextScope(state.layout, selectionResident(b.id))))
      return { boxes: [], preview: [], message: "These actions stay in their context menu." };
    let desired = { x: g.bounds.x + x - g.start.x, y: g.bounds.y + y - g.start.y };
    const occupied = obstacles(excluded, target),
      container = target ? getContainer(state.layout, target) : undefined;
    const arrangement = container?.arrangement ?? (!target ? state.layout.arrangement : undefined);
    if (zone) {
      desired = toLocal({ ...desired, width: 0, height: 0 }, zone);
      if (handleKey === target) {
        const existing = (container?.members ?? []).filter((m) => !excluded.has(selectionId(residentKey(m))));
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
      message: `Move ${placed.length} UI items ${target ? "into this frame" : "together"}${arrangement?.mode === "snap" ? " · snap" : ""}`,
    };
  };
  const ops = useRef({ compact, align, clear, group, resolve, previewAlignment });
  ops.current = { compact, align, clear, group, resolve, previewAlignment };
  useEffect(() => {
    if (command?.action === "select") {
      current.current.aligning = false;
      setAligning(false);
      setAlignment(null);
      setPreviews([]);
      setMode((v) => !v);
      setMenu(null);
    } else if (command?.action === "compact") ops.current.compact();
    else if (command?.action === "align") ops.current.align();
  }, [command?.sequence]);
  useEffect(() => {
    document.body.classList.toggle("ui-select-mode", mode || aligning);
    return () => document.body.classList.remove("ui-select-mode");
  }, [mode, aligning]);
  useEffect(() => {
    let moveFrame = 0;
    let pendingMove: PointerEvent | null = null;
    const cancelMove = () => { cancelAnimationFrame(moveFrame); moveFrame = 0; pendingMove = null; };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) {
        if ((gesture.current || current.current.aligning) && (e.button === 3 || e.button === 4)) cancel();
        return;
      }
      const target = e.target as Element,
        state = current.current;
      if (
        target.closest(
          "input,textarea,select,[contenteditable=true],.ui-selection-tools,.ui-background-menu,.ui-field-edge,[data-ui-resize]",
        )
      )
        return;
      if (state.aligning) {
        e.preventDefault();
        e.stopImmediatePropagation();
        suppress();
        ops.current.previewAlignment(target, e.clientX, e.clientY);
        gesture.current = {
          start: { x: e.clientX, y: e.clientY }, boxes: [],
          bounds: { x: 0, y: 0, width: 0, height: 0 },
          moved: false, initial: new Set(state.ids), align: true, pointerId: e.pointerId,
        };
        return;
      }
      const button = target.closest<HTMLElement>(selectable),
        id = button ? idOf(button) : undefined,
        additive = e.ctrlKey || e.metaKey;
      if (id && (!["ui:select", "ui:compact", "ui:align"].includes(id) || additive || (state.ids.size > 1 && state.ids.has(id)))) {
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
        const scope = residentContextScope(state.layout, selectionResident(id)),
          scopes = new Set([...state.ids].map(key => residentContextScope(state.layout, selectionResident(key))));
        if (additive && state.ids.size && (!scopes.has(scope) || scopes.size > 1)) {
          setMessage("Context-menu actions must be selected separately from other UI.");
          return;
        }
        if (additive) {
          const next = new Set(state.ids);
          if (next.has(id)) next.delete(id);
          else {
            let parent = ownerOf(state.layout, selectionResident(id));
            while (parent) { next.delete(selectionId(parent)); parent = ownerOf(state.layout, parent); }
            next.add(id);
          }
          select(next);
          return;
        }
        const next = state.ids.has(id) ? state.ids : new Set([id]);
        select(next);
        const boxes = buttons()
          .filter((el) => next.has(idOf(el)))
          .map((el) => ({ id: idOf(el), ...selectionBox(el) }));
        gesture.current = {
          start: { x: e.clientX, y: e.clientY },
          boxes,
          bounds: buttonBounds(boxes),
          moved: false,
          initial: new Set(next),
          clickId: id,
          pointerId: e.pointerId,
          release: captureUIPointer(e.pointerId, e.pointerType),
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
          pointerId: e.pointerId,
          release: captureUIPointer(e.pointerId, e.pointerType),
        };
        setRectangle({ x: e.clientX, y: e.clientY, width: 0, height: 0 });
        setMenu(null);
      }
    };
    const moveNow = (e: PointerEvent) => {
      const g = gesture.current;
      if (g && g.pointerId !== e.pointerId) return;
      if (current.current.aligning) {
        ops.current.previewAlignment(document.elementFromPoint(e.clientX, e.clientY) ?? e.target as Element, e.clientX, e.clientY);
        if (g) {
          e.preventDefault();
          e.stopImmediatePropagation();
          g.moved ||= Math.hypot(e.clientX - g.start.x, e.clientY - g.start.y) > 5;
        }
        return;
      }
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
            residentContextScope(current.current.layout, selectionResident(idOf(b))) === g.scope &&
            intersects(rect, boxOf(b))
          )
            next.add(idOf(b));
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
    const move = (e: PointerEvent) => {
      if (!gesture.current && !current.current.aligning) return;
      if (gesture.current && gesture.current.pointerId !== e.pointerId) return;
      if (gesture.current && (e.buttons & 1) === 0) { cancel(); return; }
      if (gesture.current) { e.preventDefault(); e.stopImmediatePropagation(); }
      pendingMove = e;
      if (!moveFrame) moveFrame = requestAnimationFrame(() => {
        moveFrame = 0;
        const event = pendingMove; pendingMove = null;
        if (event) moveNow(event);
      });
    };
    const up = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g || g.pointerId !== e.pointerId || e.button !== 0) return;
      cancelMove();
      moveNow(e);
      e.preventDefault();
      e.stopImmediatePropagation();
      suppress();
      gesture.current = null;
      g.release?.();
      setRectangle(null);
      setPreviews([]);
      if (g.align) {
        if (g.moved) return;
        const result = ops.current.previewAlignment(document.elementFromPoint(e.clientX, e.clientY) ?? e.target as Element, e.clientX, e.clientY);
        if (result?.next) {
          current.current.update(() => result.next!);
          current.current.aligning = false;
          setAligning(false);
          setAlignment(null);
          setPreviews([]);
          setMessage(`UI aligned to ${result.edge} edge. Shift+MB4 undoes it.`);
        }
        return;
      }
      if (!g.marquee && g.moved && g.proposal?.boxes.length) {
        const proposal = g.proposal;
        current.current.update((s) =>
          placeButtons({ ...s, windows: { ...current.current.layout.windows, ...s.windows } }, proposal.boxes, proposal.target, proposal.baseline),
        );
        setMessage("UI selection moved. Shift+MB4 undoes it.");
      }
    };
    const cancel = () => {
      cancelMove();
      if (!gesture.current && !current.current.aligning) return;
      const active = gesture.current;
      gesture.current = null;
      active?.release?.();
      current.current.aligning = false;
      setAligning(false);
      setAlignment(null);
      setRectangle(null);
      setPreviews([]);
      suppress();
      setMessage("Move cancelled.");
    };
    const key = (e: KeyboardEvent) => {
      const active = gesture.current || current.current.ids.size || current.current.mode || current.current.aligning;
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
          "UI items are selected; graph knowledge is unchanged. Use an item’s settings to remove it.",
        );
        return;
      }
      if (e.key === "Escape" && active) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (gesture.current || current.current.aligning) cancel();
        else ops.current.clear();
      }
    };
    const pointerCancel = (event: PointerEvent) => {
      if (gesture.current?.pointerId === event.pointerId) cancel();
    };
    const preventContext = (event: MouseEvent) => {
      if (gesture.current) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      const target = event.target as Element, selected = current.current.ids;
      if (!selected.size || target.closest('[role="menu"],.ui-selection-tools,.ui-background-menu,input,textarea,select')) return;
      const item = target.closest<HTMLElement>(selectable);
      if (item ? selected.has(idOf(item)) : !!target.closest('[data-ui-resident-root],.toolbar,.ui-workspace-overlay')) {
        event.preventDefault(); event.stopImmediatePropagation(); setMenu({ x: event.clientX, y: event.clientY });
      }
    };
    const preventNative = (event: DragEvent) => {
      if (gesture.current) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", pointerCancel, true);
    window.addEventListener("contextmenu", preventContext, true);
    window.addEventListener("dragstart", preventNative, true);
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", key, true);
    return () => {
      cancelMove();
      const active = gesture.current; gesture.current = null; active?.release?.();
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", pointerCancel, true);
      window.removeEventListener("contextmenu", preventContext, true);
      window.removeEventListener("dragstart", preventNative, true);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", key, true);
    };
  }, [suppress]);
  useEffect(() => {
    const items = buttons();
    for (const item of items) item.toggleAttribute('data-ui-selected', ids.has(idOf(item)));
    return () => { for (const item of items) item.removeAttribute('data-ui-selected'); };
  }, [ids, layout, functions]);
  return {
    ids,
    mode,
    aligning,
    visuals,
    menu,
    group,
    compact,
    align,
    clear,
    closeMenu: () => setMenu(null),
    openMenu: (x: number, y: number) => setMenu({ x, y }),
  };
}
export function ButtonSelectionOverlay({
  selection,
}: {
  selection: ReturnType<typeof useButtonSelection>;
}) {
  const visual = useSyncExternalStore(selection.visuals.subscribe, selection.visuals.getSnapshot);
  const menuRoot = useRef<HTMLDivElement>(null);
  useOutsideDismiss(!!selection.menu, () => [menuRoot.current], selection.closeMenu);
  return (
    <>
      {visual.rectangle && (
        <div
          className="ui-selection-rectangle"
          style={{
            left: visual.rectangle.x,
            top: visual.rectangle.y,
            width: visual.rectangle.width,
            height: visual.rectangle.height,
          }}
        />
      )}
      {visual.previews.map((b) => (
        <div
          key={b.id}
          className="ui-placement-preview"
          style={{ left: b.x, top: b.y, width: b.width, height: b.height }}
        />
      ))}
      {visual.alignment && (
        <div
          className={`ui-alignment-edge${visual.alignment.next ? "" : " invalid"}`}
          style={{
            left: visual.alignment.target.x + (visual.alignment.edge === "right" ? visual.alignment.target.width : 0),
            top: visual.alignment.target.y + (visual.alignment.edge === "bottom" ? visual.alignment.target.height : 0),
            width: visual.alignment.edge === "left" || visual.alignment.edge === "right" ? 0 : visual.alignment.target.width,
            height: visual.alignment.edge === "top" || visual.alignment.edge === "bottom" ? 0 : visual.alignment.target.height,
          }}
        />
      )}
      {(selection.mode || selection.ids.size > 0) && (
        <div className="ui-selection-tools" role="region" aria-label="UI selection">
          <span>{selection.ids.size} UI selected</span>
          <button disabled={selection.ids.size < 2} onClick={selection.compact}>
            Compact UI
          </button>
          <button disabled={!selection.ids.size} aria-pressed={selection.aligning} onClick={selection.align}>
            {selection.aligning ? "Cancel alignment" : "Align UI"}
          </button>
          <button onClick={selection.clear}>Done / clear</button>
          <small>
            {selection.aligning ? "Click another button’s boundary · Esc cancels" : "Ctrl/Cmd-click to add · drag selected items together"}
            {selection.mode && !selection.aligning ? " · drag a box to select" : ""}
          </small>
        </div>
      )}
      {visual.message && (
        <div className="ui-selection-message" role="status">
          {visual.message}
        </div>
      )}
      {selection.menu && (
        <ContextMenu
          opening={selection.menu}
          ref={menuRoot}
          className="ui-selection-tools"
          aria-label="Selected UI actions"
          style={{
            left: Math.max(8, Math.min(selection.menu.x, window.innerWidth - 240)),
            top: Math.max(8, Math.min(selection.menu.y, window.innerHeight - 120)),
          }}
        >
          <button className="ui-popup-close" aria-label="Close selection menu" onClick={selection.closeMenu}>×</button>
          <button disabled={selection.ids.size < 2} onClick={selection.group}>Group into frame</button>
          <button onClick={selection.compact}>Compact selected UI</button>
          <button onClick={selection.align}>Align UI to a button boundary</button>
          <button onClick={selection.clear}>Clear UI selection</button>
        </ContextMenu>
      )}
    </>
  );
}
