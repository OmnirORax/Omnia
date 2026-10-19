import type { DragEvent } from "react";
import type { Cell, UIResident } from "./layout";
export const RESIDENT_MIME = "application/x-omnium-ui-resident";
export const CONTROL_MIME = "application/x-omnium-frame-control";
export const FUNCTION_MIME = "application/x-omnium-function";
export const MAGNET_DISTANCE = 18;
export const DOCK_DISTANCE = 24;
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
