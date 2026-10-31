import { useMemo } from "react";
import { useToolCursor } from "../ui/toolCursor";
import { SelectorSymbol, SELECTOR_VIEW, type SelectorConfiguration } from "./SelectorSymbol";

/** MS keeps its live selector symbol/precision anchor; shared transport owns motion and priority. */
export function SelectorCursor({ configuration, initial, include = true, parked = false, radius,feedback }: {feedback?:string|null;radius?:number; parked?: boolean; include?: boolean; configuration: SelectorConfiguration; initial: { x: number; y: number } }) {
  const parkedX=parked?initial.x:undefined,parkedY=parked?initial.y:undefined;
  const request=useMemo(()=>({key:'visual-selector',zone:'*',priority:100,className:'visual-selector-cursor',width:radius===undefined?64:radius*SELECTOR_VIEW.width/88,height:radius===undefined?60:radius*SELECTOR_VIEW.height/88,
    icon:<><SelectorSymbol configuration={configuration} include={include} precision />{feedback&&<span className="selector-pick-feedback" role="status" aria-live="polite">{feedback}</span>}</>,
    anchor:{x:SELECTOR_VIEW.x/SELECTOR_VIEW.width,y:SELECTOR_VIEW.y/SELECTOR_VIEW.height},
    parked:parked?{x:parkedX!,y:parkedY!}:undefined,
  }),[configuration,include,parked,parkedX,parkedY,radius,feedback]);
  useToolCursor(request);
  return null;
}
