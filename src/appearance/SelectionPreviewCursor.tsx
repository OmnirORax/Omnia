import {useId,useLayoutEffect,type RefObject} from 'react';
import {useNumericEditor} from '../ui/NumericEditorScope';
import {setToolCursorZone} from '../ui/toolCursorZone';
import {useVisualSelection} from './VisualSelector';
import {SelectorCursor} from './SelectorCursor';
/** Call from the component owning the host ref, whose layout effects run after
 * attachment. A child effect cannot register an ancestor that has not attached.
 * A value projection may keep its owner's baseline selector visible without
 * lending selection capture to popup chrome. The existing field still owns input. */
export function useSelectionPreviewCursor(surface:RefObject<HTMLElement|null>){
 const editor=useNumericEditor(),selection=useVisualSelection(),zone=useId(),enabled=!!editor.selectionCursor&&!!selection;
 useLayoutEffect(()=>{const node=surface.current;if(!node||!enabled)return;setToolCursorZone(node,zone,true);return()=>setToolCursorZone(node,undefined);},[surface,zone,enabled]);
 return enabled?<SelectorCursor configuration={selection!.cursorConfiguration} initial={{x:0,y:0}} zone={zone}/>:null;
}
