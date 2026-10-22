import type { KeyboardEvent } from "react";
import { PATTERN_SYMBOLS, type PatternMode } from "./selectionGeometry";
import type { VisualRole } from "./visualSelection";
/** Hotspot in the supplied SVG's coordinate system. */
export const SELECTOR_VIEW = { width: 320, height: 300, x: 140, y: 136 } as const;

export type SelectorOperation = "include" | "exclude" | null;
export type SelectorRegion = "inside" | "outside" | null;
export type SelectorConfiguration = {
  boundaryPicking: boolean;
  pattern: PatternMode;
  patternRole: VisualRole | null;
  bounded: boolean;
  stopAtPaint: boolean;
  operation: SelectorOperation;
  region: SelectorRegion;
};
type Actions = {
  boundary: () => void;
  pattern: () => void;
  operation: (operation: Exclude<SelectorOperation, null>) => void;
  region: (region: Exclude<SelectorRegion, null>) => void;
  previewRegion: (region: Exclude<SelectorRegion, null> | null) => void;
};

/** One geometric symbol supplies stationary controls and the noninteractive cursor. */
export function SelectorSymbol({ configuration, actions, precision = false }: { configuration: SelectorConfiguration; actions?: Actions; precision?: boolean }) {
  const { boundaryPicking, pattern, operation, region } = configuration;
  const button = (label: string, pressed: boolean, action: () => void) => actions ? {
    role: "button", tabIndex: 0, "aria-label": label, "aria-pressed": pressed,
    onClick: action,
    onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); action(); }
    },
  } : { "data-active": pressed };
  const preview = (side: "inside" | "outside") => actions ? {
    onPointerEnter: () => actions.previewRegion(side), onPointerLeave: () => actions.previewRegion(null),
    onFocus: () => actions.previewRegion(side), onBlur: () => actions.previewRegion(null),
  } : {};
  return <svg className={`visual-selector-symbol operation-${operation ?? "neutral"}`} viewBox="0 0 320 300"
    aria-label={actions ? "Boundary, inside, outside, include, exclude and pattern" : undefined} aria-hidden={actions ? undefined : true}>
    <g className="selector-outside" {...button("Outside boundary", region === "outside", () => actions?.region("outside"))} {...preview("outside")}>
      {actions && <title>Outside: apply the include/exclude operation outside the boundary. Press again to clear the region choice.</title>}
      {actions && <circle className="selector-hit" cx="140" cy="136" r="119" fill="none" strokeWidth="34" />}
      <circle className="selector-region-mark" cx="140" cy="136" r="119" fill="none" strokeWidth="30" />
      <circle className="selector-outside-edge" cx="140" cy="136" r="133" fill="none" strokeWidth="1.5" />
    </g>
    <g className="selector-inside" {...button("Inside boundary", region === "inside", () => actions?.region("inside"))} {...preview("inside")}>
      {actions && <title>Inside: apply the include/exclude operation inside the boundary. Press again to clear the region choice.</title>}
      {actions && <circle className="selector-hit" cx="140" cy="136" r="68" />}
      <circle className="selector-region-mark" cx="140" cy="136" r="65" />
    </g>
    <g {...button("Set boundary", boundaryPicking, () => actions?.boundary())}>
      {actions && <title>Ring: choose or replace the boundary. Placement fixes it and finishes boundary picking. Scroll while aiming to change boundary depth.</title>}
      {actions && <circle className="selector-hit" cx="140" cy="136" r="88" fill="none" strokeWidth="32" />}
      <circle className="selector-ring" cx="140" cy="136" r="88" fill="none" strokeWidth="20" />
    </g>
    <g className="selector-include" {...button("Include", operation === "include", () => actions?.operation("include"))}>
      {actions && <title>Inner bar: include (green). Press again for a neutral operation.</title>}
      {actions && <rect className="selector-hit" x="171" y="114" width="58" height="44" />}
      <path className="selector-bar" d="M175 136H229" strokeWidth="24" />
    </g>
    <g className="selector-exclude" {...button("Exclude", operation === "exclude", () => actions?.operation("exclude"))}>
      {actions && <title>Outer bar: exclude (red). Press again for a neutral operation.</title>}
      {actions && <rect className="selector-hit" x="233" y="114" width="71" height="44" />}
      <path className="selector-bar" d="M233 136H300" strokeWidth="24" />
    </g>
    <g {...button(`Pattern mode: ${pattern}`, pattern !== "item", () => actions?.pattern())}>
      {actions && <title>Cycle: individual · pattern ⠒ · axis ↕ · direction ↑ · position |. E also cycles. Drag to place a line; every touched pattern is selected unless a pattern filter is chosen.</title>}
      {actions && <rect className="selector-hit" x="97" y="228" width="88" height="46" />}
      {pattern === "item" ? <circle className="selector-dot" cx="140" cy="250" r="15" /> : pattern === "pattern" ? <>
        <circle className="selector-dot" cx="123" cy="250" r="15" />
        <circle className="selector-dot" cx="159" cy="250" r="15" />
      </> : <text className="selector-mode-symbol" x="140" y="266" textAnchor="middle">{PATTERN_SYMBOLS[pattern]}</text>}
    </g>
    {precision && <circle className="selector-precision-dot" cx={SELECTOR_VIEW.x} cy={SELECTOR_VIEW.y} r="5" />}
  </svg>;
}
