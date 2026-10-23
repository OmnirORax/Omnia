import type { KeyboardEvent } from "react";
import { PATTERN_SYMBOLS, type PatternMode, type SelectionSide } from "./selectionGeometry";
import type { VisualRole } from "./visualSelection";
export const SELECTOR_VIEW = { width: 320, height: 300, x: 140, y: 136 } as const;
import type { SelectionMask } from "./selectionToggle";
export type SelectorConfiguration = SelectionMask & {
  pattern: PatternMode;
  patternRole: VisualRole | null;
  bounded: boolean;
  stopAtPaint: boolean;
  closed: boolean;
  rotation: number;
};
type Actions = {
  contour: () => void;
  pattern: () => void;
  region: (region: SelectionSide) => void;
  previewRegion: (region: SelectionSide | null) => void;
};
/** One circle configures path, inside and outside independently of geometry mode. */
export function SelectorSymbol({ configuration, actions, precision = false, patternBinding, include = true }: { include?: boolean; configuration: SelectorConfiguration; actions?: Actions; precision?: boolean; patternBinding?: string }) {
  const { contour, pattern, region } = configuration;
  const button = (label: string, pressed: boolean, action: () => void) => actions ? {
    role: "button", tabIndex: 0, "aria-label": label, "aria-pressed": pressed,
    onClick: action,
    onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); action(); }
    },
  } : { "data-active": pressed };
  const preview = (side: SelectionSide) => actions ? {
    onPointerEnter: () => actions.previewRegion(side), onPointerLeave: () => actions.previewRegion(null),
    onFocus: () => actions.previewRegion(side), onBlur: () => actions.previewRegion(null),
  } : {};
  return <svg className={`visual-selector-symbol operation-${include ? "include" : "exclude"}`} viewBox="0 0 320 300"
    aria-label={actions ? "Contour, inside, outside and selection geometry" : undefined} aria-hidden={actions ? undefined : true}>
    <g className="selector-outside" {...button("⏺ Outside frame", region === "outside" || region === "both", () => actions?.region("outside"))} {...preview("outside")}>
      {actions && <title>Outside frame: include everything outside the boundary. Independent of In-frame and Frame.</title>}
      {actions && <circle className="selector-hit" cx="140" cy="136" r="119" fill="none" strokeWidth="34" />}
      <circle className="selector-region-mark" cx="140" cy="136" r="119" fill="none" strokeWidth="30" />
      <circle className="selector-outside-edge" cx="140" cy="136" r="133" fill="none" strokeWidth="1.5" />
    </g>
    <g className="selector-inside" {...button("◉ In-frame", region === "inside" || region === "both", () => actions?.region("inside"))} {...preview("inside")}>
      {actions && <title>In-frame: include everything inside the boundary, excluding the frame itself.</title>}
      {actions && <circle className="selector-hit" cx="140" cy="136" r="68" />}
      <circle className="selector-region-mark" cx="140" cy="136" r="65" />
    </g>
    <g {...button("🞅 Frame", contour, () => actions?.contour())}>
      {actions && <title>Frame: include the frame itself or open-path intersections. With all three off, click to define a neutral frame; detection then follows the pointer inside or outside.</title>}
      {actions && <circle className="selector-hit" cx="140" cy="136" r="88" fill="none" strokeWidth="32" />}
      <circle className="selector-ring" cx="140" cy="136" r="88" fill="none" strokeWidth="9" />
    </g>
    <g {...button(`Selection mode: ${pattern}`, true, () => actions?.pattern())}>
      {actions && <title>Cycle selection geometry{patternBinding ? ` (${patternBinding})` : ""}. Click toggles selection; unchecked regions start off. Polygon: click vertices, then Enter or the first vertex to finish.</title>}
      {actions && <rect className="selector-hit" x="97" y="228" width="88" height="46" />}
      <text className="selector-mode-symbol" x="140" y="266" textAnchor="middle">{PATTERN_SYMBOLS[pattern]}</text>
    </g>
    {precision && <g className="selector-precision" aria-hidden="true">
      <circle className="selector-precision-dot" cx={SELECTOR_VIEW.x} cy={SELECTOR_VIEW.y} r={actions ? 5 : 10} />
    </g>}
  </svg>;
}
