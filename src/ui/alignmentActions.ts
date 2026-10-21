import type { AlignmentOperation } from "./selection";

/** Shared order and default notation for alignment controls, names and library entries. */
export const ALIGNMENT_ACTIONS: { id: AlignmentOperation; label: string; symbol: string }[] = [
  { id: "top", label: "Align top", symbol: "↑" },
  { id: "bottom", label: "Align bottom", symbol: "↓" },
  { id: "left", label: "Align left", symbol: "←" },
  { id: "right", label: "Align right", symbol: "→" },
  { id: "centerY", label: "Center vertically", symbol: "↓↑" },
  { id: "centerX", label: "Center horizontally", symbol: "→←" },
  { id: "distributeY", label: "Distribute vertically", symbol: "↕" },
  { id: "distributeX", label: "Distribute horizontally", symbol: "↔" },
];
