import type { DragEvent } from "react";
import type { Cell, UIResident } from "./layout";
import { claimUIPress } from "./pointerOwnership.ts";
export const RESIDENT_MIME = "application/x-omnium-ui-resident";
export const CONTROL_MIME = "application/x-omnium-frame-control";
export const FUNCTION_MIME = "application/x-omnium-function";
export const MAGNET_DISTANCE = 18;
export const DOCK_DISTANCE = 24;
/** Capture on a stable root, never a handle that may move/remount during a preview. */
export function captureUIPointer(pointerId: number, pointerType = "mouse") {
  const root = document.documentElement;
  let active = true;
  claimUIPress(pointerId, pointerType);
  const capture = () => {
    if (!active) return;
    try { root.setPointerCapture(pointerId); }
    catch { /* A cancelled pointer stream can no longer be captured. */ }
  };
  const lost = (event: PointerEvent) => {
    if (event.target === root && event.pointerId === pointerId) queueMicrotask(capture);
  };
  window.addEventListener("lostpointercapture", lost, true);
  capture();
  root.classList.add("ui-pointer-dragging");
  return () => {
    active = false;
    window.removeEventListener("lostpointercapture", lost, true);
    root.classList.remove("ui-pointer-dragging");
    if (root.hasPointerCapture(pointerId)) root.releasePointerCapture(pointerId);
  };
}
export function startResidentDrag(event: DragEvent, key: string) {
  if ((event.target as Element).closest("input,textarea,select")) {
    event.preventDefault();
    return;
  }
  event.stopPropagation();
  event.dataTransfer.setData(RESIDENT_MIME, key);
  event.dataTransfer.effectAllowed = "move";
}
export type Rect = { x: number; y: number; width: number; height: number };
export function rectDistance(x: number, y: number, rect: Rect) {
  return Math.hypot(
    Math.max(rect.x - x, 0, x - rect.x - rect.width),
    Math.max(rect.y - y, 0, y - rect.y - rect.height),
  );
}
export function magnetActive(
  x: number,
  y: number,
  target: Rect,
  sameCategory: boolean,
  enabled: boolean,
) {
  return sameCategory && enabled && rectDistance(x, y, target) <= MAGNET_DISTANCE;
}
export type DockPreview = {
  screenRect?: Rect;
  key: string;
  target: string;
  index: number;
  breakBefore: boolean;
  width: number;
  height: number;
  magnetic?: boolean;
  position?: Cell;
  baseline?: UIResident[];
};
export type PlacementPreview = { dock?: DockPreview; rect?: Rect; text: string };
