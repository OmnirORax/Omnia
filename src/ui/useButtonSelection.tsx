import { frameInteriorDrop, pointedDropSurface } from "./dropSurface";
import { PAGE_INPUT_SUSPEND } from "./pageInputBoundary";
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
  buttonRange,
  arrangeButtons,
  compactButtons,
  intersects,
  placeButtons,
  selectionId,
  selectionResident,
  type AlignmentOperation,
  type AlignmentReference,
  type ButtonBox,
} from "./selection";
import { snapshotPositions, type PositionedBox } from "./positioning";
import { captureUIPointer, rectDistance } from "./drag";
import { residentBounds } from "./frameBounds";
import { useOutsideDismiss } from "./useOutsideDismiss";
import { ContextMenu, contextMenuRoots } from "./ContextMenu";
import { ContextSubmenu } from "./ContextSubmenu";
import { AlignmentControls } from "./AlignmentControls";
import { FloatingWindow } from "./FloatingWindow";
import { beginLiveDrag, dragSurface } from "./liveDrag";
import { residentMovable } from "./rigidity";

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
  target?: string;
  baseline?: UIResident[];
  index?: number;
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
  pointerId?: number;
  release?: () => void;
  live?: ReturnType<typeof beginLiveDrag>;
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
    [locked, setLocked] = useState(false),
    [mode, setMode] = useState(false),
    [alignOpen, setAlignOpen] = useState(false),
    [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [visuals] = useState(() => createTransientStore({
    rectangle: null as PositionedBox | null,
    message: "",
  }));
  const setRectangle = (rectangle: PositionedBox | null) => visuals.set({ ...visuals.getSnapshot(), rectangle });
  const setMessage = (message: string) => {
    if (message !== visuals.getSnapshot().message) visuals.set({ ...visuals.getSnapshot(), message });
  };
  const current = useRef({ layout, update, functions, ids, locked, mode, alignOpen });
  current.current = { layout, update, functions, ids, locked, mode, alignOpen };
  const gesture = useRef<Gesture | null>(null);
  const rangeAnchor = useRef<string | null>(null);
  const select = (next: Set<string>) => {
    next = new Set([...next].filter(id => {
      let parent = ownerOf(current.current.layout, selectionResident(id));
      while (parent) { if (next.has(selectionId(parent))) return false; parent = ownerOf(current.current.layout, parent); }
      return true;
    }));
    if (!next.size) {
      current.current.locked = false;
      setLocked(false);
    }
    if (next.size === current.current.ids.size && [...next].every((id) => current.current.ids.has(id))) return;
    current.current.ids = next;
    setIds(next);
  };
  const clear = () => {
    rangeAnchor.current = null;
    const active = gesture.current;
    gesture.current = null;
    active?.live?.restore();
    active?.release?.();
    select(new Set());
    setMode(false);
    setAlignOpen(false);
    setMenu(null);
    setMessage("");
  };
  const toggleLock = () => {
    if (!current.current.ids.size) return;
    const next = !current.current.locked;
    current.current.locked = next;
    setLocked(next);
    setMenu(null);
    setMessage(next ? "Selection locked. Esc or Clear still clears it." : "Selection unlocked.");
  };
  const editable = (el: HTMLElement) =>
    !residentPinned(current.current.layout, selectionResident(idOf(el))) &&
    !residentPinned(
      current.current.layout,
      el.closest<HTMLElement>("[data-ui-resident-root]")?.dataset.uiResidentRoot ?? "",
    );
  const collectionOf = (el: HTMLElement): string => {
    const key = selectionResident(idOf(el)), owner = ownerOf(current.current.layout, key);
    if (owner) return owner;
    let root = el.closest<HTMLElement>("[data-ui-resident-root]");
    if (root?.dataset.uiResidentRoot === key) root = root.parentElement?.closest<HTMLElement>("[data-ui-resident-root]") ?? null;
    return root?.dataset.uiResidentRoot ?? (el.closest(".toolbar") ? "@toolbar" : "@workspace");
  };
  const selectedBoxes = () =>
    buttons()
      .filter((el) => current.current.ids.has(idOf(el)))
      .map((el) => ({ id: idOf(el), ...selectionBox(el) }));
  const requireMovable = (boxes: ButtonBox[]) => {
    const { layout, functions } = current.current;
    if (boxes.some(box => !residentMovable(layout, selectionResident(box.id), functions)))
      throw new Error("Enable UI edit mode to rearrange fixed UI. Pinned items must also be unpinned.");
  };
  const group = () => {
    try {
      const boxes = selectedBoxes();
      requireMovable(boxes);
      if (boxes.length < 2) throw new Error("Select at least two UI items to group.");
      const bounds = buttonBounds(boxes);
      const next = groupResidents(current.current.layout, boxes.map(box => selectionResident(box.id)), bounds.x, bounds.y);
      current.current.update(() => next);
      select(new Set()); setMenu(null);
      setMessage("Selection grouped in a frame. Undo reverses it.");
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
    setAlignOpen(false);
    try {
      const state = current.current,
        all = selectedBoxes();
      requireMovable(all);
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
        if (owner && getContainer(state.layout, owner)?.layoutMode === "stacked") throw new Error("Stacked sections already flow automatically. Switch their frame to Freeform to compact positions.");
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
      setMessage("Selected UI compacted. Undo reverses it.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };
  const align = () => {
    if (!selectedBoxes().length) {
      setMessage("Select the UI items to align first.");
      return;
    }
    setAlignOpen(true);
    setMenu(null);
  };
  const arrange = (operation: AlignmentOperation, reference: AlignmentReference, targetIds = current.current.ids) => {
    try {
      const state = current.current;
      const entries = buttons().filter(el => !el.closest('.ui-selection-tools,.ui-background-menu,[data-ui-alignment],[data-ui-resident-root="window:ui-alignment"]')).map(element => {
        const id = idOf(element), key = selectionResident(id), collection = collectionOf(element), parents = new Set<string>();
        for (let owner: string | undefined = collection; owner && !owner.startsWith("@") && !parents.has(owner); owner = ownerOf(state.layout, owner)) parents.add(owner);
        for (let root = element.closest<HTMLElement>("[data-ui-resident-root]"); root; root = root.parentElement?.closest<HTMLElement>("[data-ui-resident-root]") ?? null)
          if (root.dataset.uiResidentRoot !== key) parents.add(root.dataset.uiResidentRoot!);
        return { id, key, element, collection, parents, box: { id, ...selectionBox(element) } };
      });
      const selected = entries.filter(entry => targetIds.has(entry.id));
      const roots = selected.filter(entry => !selected.some(parent => parent !== entry &&
        (parent.element.contains(entry.element) || entry.parents.has(parent.key))));
      const source = roots.map(entry => entry.box);
      requireMovable(source);
      if (!source.length) throw new Error("Select visible UI items to align first.");
      const area = { x: 8, y: 8, width: innerWidth - 16, height: innerHeight - 16 };
      const target = reference === "selection" ? buttonBounds(source) : area;
      const candidates = entries.filter(entry => !roots.some(parent => parent.key === entry.key ||
        parent.element.contains(entry.element) || entry.parents.has(parent.key)));
      const occupied = Object.fromEntries(roots.map(entry => [entry.id, candidates.filter(other =>
        !other.element.contains(entry.element) && !entry.parents.has(other.key) &&
        (other.collection === entry.collection || other.collection === "@workspace" || other.collection === "@toolbar"))
        .map(other => other.box)]));
      const limits = Object.fromEntries(roots.flatMap(entry => {
        // Native controls that will float can use the full workspace. Members
        // remaining inside a fixed window must fit its visible content area.
        if (!ownerOf(state.layout, entry.key)) return [];
        const body = entry.element.closest<HTMLElement>(".floating-body");
        if (!body) return [];
        const rect = body.getBoundingClientRect(), style = getComputedStyle(body);
        const left = parseFloat(style.paddingLeft) || 0, right = parseFloat(style.paddingRight) || 0;
        const top = parseFloat(style.paddingTop) || 0, bottom = parseFloat(style.paddingBottom) || 0;
        return [[entry.id, { x: rect.x + left, y: rect.y + top,
          width: body.clientWidth - left - right, height: body.clientHeight - top - bottom }]];
      }));
      const placed = arrangeButtons(source, target, operation, { area, obstacles: occupied, bounds: limits });
      const groups = new Map<string | undefined, ButtonBox[]>();
      for (const box of placed) {
        const owner = ownerOf(state.layout, selectionResident(box.id));
        if (owner && getContainer(state.layout, owner)?.dockLayout)
          throw new Error("Drag these items out of their dock before aligning them. Docked panes follow their split or tab layout.");
        if (owner && getContainer(state.layout, owner)?.layoutMode === "stacked")
          throw new Error("Stacked sections align automatically. Switch their frame to Freeform to align individual positions.");
        groups.set(owner, [...groups.get(owner) ?? [], box]);
      }
      let next = state.layout;
      for (const [owner, group] of groups) {
        const zone = owner ? zoneFor(owner) : undefined;
        if (owner && !zone) throw new Error("Expand the selected items’ frame before aligning.");
        const local = zone ? group.map(box => ({ ...box, ...toLocal(box, zone) })) : group.map(box => {
          const key = selectionResident(box.id), saved = getContainer(state.layout, key), original = source.find(item => item.id === box.id)!;
          return saved ? { ...box, x: saved.x + box.x - original.x, y: saved.y + box.y - original.y } : box;
        });
        next = placeButtons(next, local, owner, zone ? baselineOf(state.layout, owner!, zone) : undefined);
      }
      state.update(() => next);
      setMenu(null);
      setMessage(`UI ${operation.startsWith("distribute") ? "distributed" : "aligned"}. Undo reverses it.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
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
      const surface = pointedDropSurface(elements), key = surface?.dataset.uiResidentRoot;
      const interiorZone = key ? zoneFor(key) : undefined;
      const intent = frameInteriorDrop(state.layout, g.boxes.map(box => selectionResident(box.id)), key, !!interiorZone?.getClientRects().length);
      if (intent === "blocked") return { boxes: [], message: "This frame cannot accept these items here; placement is unchanged." };
      if (intent === "dock") { zone = interiorZone; target = key; }
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
        message: !zone
          ? "Expand this frame to place multiple buttons."
          : "Unpin the target, or keep these actions in their owning menu.",
      };
    if (!target && g.boxes.some((b) => residentContextScope(state.layout, selectionResident(b.id))))
      return { boxes: [], message: "These actions stay in their context menu." };
    let desired = { x: g.bounds.x + x - g.start.x, y: g.bounds.y + y - g.start.y };
    const container = target ? getContainer(state.layout, target) : undefined;
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
    } else {
      if (g.bounds.width > window.innerWidth - 16 || g.bounds.height > window.innerHeight - 16)
        return {
          boxes: [],
          message: "Compact the selection first so it fits in the workspace.",
        };
      desired = {
        x: Math.max(8, Math.min(desired.x, window.innerWidth - g.bounds.width - 8)),
        y: Math.max(8, Math.min(desired.y, window.innerHeight - g.bounds.height - 8)),
      };
    }
    const placed = g.boxes.map((b) => ({
      ...b,
      x: desired.x + b.x - g.bounds.x,
      y: desired.y + b.y - g.bounds.y,
    }));
    const stackSlots = zone && container?.layoutMode === "stacked" ? [...zone.querySelectorAll<HTMLElement>(":scope > [data-ui-slot-key]")]
      .filter(slot => !excluded.has(selectionId(slot.dataset.uiSlotKey!))) : undefined;
    const before = stackSlots?.find(slot => { const r = slot.getBoundingClientRect(); return y < r.y + r.height / 2; });
    const stackKeys = container?.members?.map(residentKey).filter(key => !excluded.has(selectionId(key))) ?? [];
    return {
      boxes: placed,
      target,
      index: stackSlots ? before ? stackKeys.indexOf(before.dataset.uiSlotKey!) : stackKeys.length : undefined,
      baseline: zone && !stackSlots ? baselineOf(state.layout, target!, zone) : undefined,
      message: `Move ${placed.length} UI items ${target ? "into this frame" : "together"}`,
    };
  };
  const ops = useRef({ compact, align, clear, group, resolve });
  ops.current = { compact, align, clear, group, resolve };
  useEffect(() => {
    if (command?.action === "select") {
      setAlignOpen(false);
      setMode((v) => !v);
      setMenu(null);
    } else if (command?.action === "compact") ops.current.compact();
    else if (command?.action === "align") ops.current.align();
  }, [command?.sequence]);
  useEffect(() => {
    document.body.classList.toggle("ui-select-mode", mode);
    return () => document.body.classList.remove("ui-select-mode");
  }, [mode]);
  useEffect(() => {
    let moveFrame = 0;
    let pendingMove: PointerEvent | null = null;
    const cancelMove = () => { cancelAnimationFrame(moveFrame); moveFrame = 0; pendingMove = null; };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) {
        if (gesture.current && (e.button === 3 || e.button === 4)) cancel();
        return;
      }
      const target = e.target as Element,
        state = current.current,
        additive = e.ctrlKey || e.metaKey,
        range = e.shiftKey;
      const button = target.closest<HTMLElement>(selectable),
        id = button ? idOf(button) : undefined,
        selectedPress = !!id && state.ids.has(id),
        selectionCommand = !!id && (["ui:select", "ui:compact", "ui:align"].includes(id) || id.startsWith("ui:align:")),
        selectionTools = target.closest('.ui-selection-tools,.ui-background-menu,[data-ui-alignment],[data-ui-resident-root="window:ui-alignment"]'),
        editing = target.closest('input,textarea,select,[contenteditable=true],[data-ui-resize]');
      // Dismiss before returning to input/canvas handlers, without consuming the
      // press. Selection commands and modifier gestures retain their targets.
      if (!additive && !range && !state.locked && state.ids.size && !selectionTools && !selectionCommand &&
          (!selectedPress || editing) && (!state.mode || editing)) ops.current.clear();
      if (selectionTools || editing || (!additive && !range && !selectedPress && target.closest(".ui-field-edge"))) return;
      if (state.locked && !additive && !range && !selectedPress) return;
      if (id && (!selectionCommand || additive || range || selectedPress)) {
        if (!state.mode && !additive && !range && !state.ids.has(id)) return;
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
        if (range) {
          const collection = collectionOf(button!);
          const peers = buttons().filter(el => editable(el) && collectionOf(el) === collection &&
            residentContextScope(state.layout, selectionResident(idOf(el))) === scope);
          const anchor = rangeAnchor.current && peers.some(el => idOf(el) === rangeAnchor.current)
            ? rangeAnchor.current : undefined;
          if (!anchor) rangeAnchor.current = id;
          const span = buttonRange(peers.map(el => ({ id: idOf(el), ...selectionBox(el) })), anchor ?? id, id);
          const next = new Set(additive ? state.ids : []);
          for (const member of span) {
            let parent = ownerOf(state.layout, selectionResident(member));
            while (parent) { next.delete(selectionId(parent)); parent = ownerOf(state.layout, parent); }
            next.add(member);
          }
          select(next);
          return;
        }
        rangeAnchor.current = id;
        if (additive) {
          const next = new Set(state.ids);
          if (next.has(id)) next.delete(id);
          else {
            let parent = ownerOf(state.layout, selectionResident(id));
            while (parent) { next.delete(selectionId(parent)); parent = ownerOf(state.layout, parent); }
            next.add(id);
          }
          select(next);
          if (!next.size) rangeAnchor.current = null;
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
        ((state.mode && !state.locked) || (additive && target.closest("[data-ui-resident-root],.toolbar"))) &&
        !target.closest("button,a,[data-ui-drag],.window-resize-grip")
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        suppress();
        const scope = target.closest<HTMLElement>("[data-ui-drop-zone]")?.dataset.uiDropZone;
        rangeAnchor.current = null;
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
          requireMovable(g.boxes);
          if (!g.live) {
            const sources = buttons().filter(el => g.initial.has(idOf(el))).map(el => {
              const key = selectionResident(idOf(el));
              const root = !key.startsWith('function:') && [...document.querySelectorAll<HTMLElement>('[data-ui-resident-root]')]
                .find(root => root.dataset.uiResidentRoot === key && visible(root));
              return dragSurface(root || el);
            });
            g.live = beginLiveDrag(sources);
          }
          g.live.move(e.clientX - g.start.x, e.clientY - g.start.y);
          g.proposal = ops.current.resolve(g, e.clientX, e.clientY);
          setMessage(g.proposal.message);
        } catch (error) {
          g.proposal = undefined;
          setMessage(error instanceof Error ? error.message : String(error));
        }
      }
    };
    const move = (e: PointerEvent) => {
      if (!gesture.current) return;
      if (gesture.current && gesture.current.pointerId !== e.pointerId) return;
      if (gesture.current && (e.buttons & 1) === 0) { cancel(); return; }
      if (gesture.current) { e.preventDefault(); e.stopImmediatePropagation(); }
      gesture.current.live?.move(e.clientX - gesture.current.start.x, e.clientY - gesture.current.start.y);
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
      g.live?.restore();
      g.release?.();
      setRectangle(null);
      if (!g.marquee && !g.moved && !current.current.locked) {
        ops.current.clear();
        return;
      }
      if (!g.marquee && g.moved && g.proposal?.boxes.length) {
        const proposal = g.proposal;
        current.current.update((s) =>
          placeButtons({ ...s, windows: { ...current.current.layout.windows, ...s.windows } }, proposal.boxes, proposal.target, proposal.baseline, proposal.index),
        );
        setMessage("UI selection moved. Undo reverses it.");
      }
    };
    const cancel = () => {
      cancelMove();
      if (!gesture.current) return;
      const active = gesture.current;
      gesture.current = null;
      active.live?.restore();
      active?.release?.();
      setAlignOpen(false);
      setRectangle(null);
      suppress();
      setMessage("Move cancelled.");
    };
    const key = (e: KeyboardEvent) => {
      const active = gesture.current || current.current.ids.size || current.current.mode || current.current.alignOpen;
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
        if (gesture.current) cancel();
        else if (current.current.alignOpen) setAlignOpen(false);
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
    window.addEventListener(PAGE_INPUT_SUSPEND, cancel);
    window.addEventListener("keydown", key, true);
    return () => {
      cancelMove();
      const active = gesture.current; gesture.current = null; active?.live?.restore(); active?.release?.();
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", pointerCancel, true);
      window.removeEventListener("contextmenu", preventContext, true);
      window.removeEventListener("dragstart", preventNative, true);
      window.removeEventListener(PAGE_INPUT_SUSPEND, cancel);
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
    locked,
    toggleLock,
    mode,
    alignOpen,
    arrange,
    closeAlignment: () => setAlignOpen(false),
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
  useOutsideDismiss(!!selection.menu, () => contextMenuRoots(menuRoot.current), selection.closeMenu);
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
      {(selection.mode || selection.ids.size > 0) && (
        <div className="ui-selection-tools" role="region" aria-label="UI selection">
          <span>{selection.ids.size} UI selected{selection.locked ? " · locked" : ""}</span>
          <button disabled={selection.ids.size < 2} onClick={selection.compact}>
            Compact UI
          </button>
          <button disabled={!selection.ids.size} aria-pressed={selection.alignOpen} onClick={selection.align}>
            Align UI
          </button>
          <button onClick={selection.clear}>Done / clear</button>
          <small>
            Ctrl/Cmd-click to add · Shift-click for a range · drag selected items together
            {selection.mode ? " · drag a box to select" : ""}
          </small>
        </div>
      )}
      {visual.message && (
        <div className="ui-selection-message" role="status">
          {visual.message}
        </div>
      )}
      {selection.alignOpen && <FloatingWindow id="ui-alignment" title="Align UI" width={280} height={460} onClose={selection.closeAlignment}>
        <AlignmentControls count={selection.ids.size} onArrange={selection.arrange} />
      </FloatingWindow>}
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
          <button aria-pressed={selection.locked} onClick={selection.toggleLock}>
            {selection.locked ? "Unlock selection" : "Lock selection"}
          </button>
          <button disabled={selection.ids.size < 2} onClick={selection.group}>Group into frame</button>
          <button onClick={selection.compact}>Compact selected UI</button>
          <ContextSubmenu label="Align">
            <AlignmentControls count={selection.ids.size} onArrange={selection.arrange} />
          </ContextSubmenu>
          <button onClick={selection.clear}>Clear UI selection</button>
        </ContextMenu>
      )}
    </>
  );
}
