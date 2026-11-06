import {useId,useLayoutEffect,type RefObject} from 'react';
import {useNumericEditor} from '../ui/NumericEditorScope';
import {setToolCursorZone} from '../ui/toolCursorZone';
import {useVisualSelection} from './VisualSelector';
import {SelectorCursor} from './SelectorCursor';
/** A value projection may keep its owner's baseline selector visible without
 * lending selection capture to popup chrome. The existing field still owns input. */
export function SelectionPreviewCursor({surface}:{surface:RefObject<HTMLElement|null>}){
 const editor=useNumericEditor(),selection=useVisualSelection(),zone=useId(),enabled=!!editor.selectionCursor&&!!selection;
 useLayoutEffect(()=>{const node=surface.current;if(!node||!enabled)return;setToolCursorZone(node,zone,true);return()=>setToolCursorZone(node,undefined);},[surface,zone,enabled]);
 return enabled?<SelectorCursor configuration={selection!.cursorConfiguration} initial={{x:0,y:0}} zone={zone}/>:null;
}
