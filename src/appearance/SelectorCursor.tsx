import { useMemo } from "react";
import { useToolCursor } from "../ui/toolCursor";
import { SelectorSymbol, SELECTOR_VIEW, type SelectorConfiguration } from "./SelectorSymbol";

/** MS keeps its live selector symbol/precision anchor; shared transport owns motion and priority. */
export function SelectorCursor({ configuration, initial, include = true, parked = false }: { parked?: boolean; include?: boolean; configuration: SelectorConfiguration; initial: { x: number; y: number } }) {
  const parkedX=parked?initial.x:undefined,parkedY=parked?initial.y:undefined;
  const request=useMemo(()=>({key:'visual-selector',zone:'*',priority:100,className:'visual-selector-cursor',width:64,height:60,
    icon:<SelectorSymbol configuration={configuration} include={include} precision />,
    anchor:{x:SELECTOR_VIEW.x/SELECTOR_VIEW.width,y:SELECTOR_VIEW.y/SELECTOR_VIEW.height},
    parked:parked?{x:parkedX!,y:parkedY!}:undefined,
  }),[configuration,include,parked,parkedX,parkedY]);
  useToolCursor(request);
  return null;
}
