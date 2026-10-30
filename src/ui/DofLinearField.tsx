import {useValueConfirmation} from './useValueConfirmation';
import {useLayoutEffect,useRef} from 'react';
import {linearFieldCandidate,type StateField} from '../properties/stateField';
import {createStateActivation} from '../properties/stateSelection';
import {claimUIPress} from './pointerOwnership';
import {rangeLabel} from './rangeMath';
/** Linear projection of the same prepared possibility space as the axis wheel. */
export function DofLinearField({field,value,label,onPreview,onCommit,onCancel}:{field:StateField;value:number;label:string;onPreview:(n:number)=>void;onCommit:(n:number)=>void;onCancel:()=>void}){
 const root=useRef<HTMLDivElement>(null),bounds=useRef<DOMRect|null>(null),activation=useRef(createStateActivation()),hover=useRef<number|undefined>(undefined);
 useLayoutEffect(()=>{const node=root.current;if(!node)return;const measure=()=>{bounds.current=node.getBoundingClientRect();};const observer=new ResizeObserver(measure);observer.observe(node);measure();return()=>observer.disconnect();},[]);
 const pick=(x:number)=>{const box=bounds.current;if(!box)return;return linearFieldCandidate(field,(x-box.left)/box.width)?.value;};
 const cancel=()=>{hover.current=undefined;activation.current.cancel();onCancel();};
 const confirm=useValueConfirmation({owner:root,selection:'single',candidate:()=>hover.current,onCommit});
 return <div ref={root} className="dof-linear-field" role="group" aria-label={`${label} possibility space`} data-ui-popup-interior
  onPointerEnter={()=>{if(root.current)bounds.current=root.current.getBoundingClientRect();}}
  onPointerMove={event=>{const next=pick(event.clientX);if(next!==undefined&&next!==hover.current){hover.current=next;onPreview(next);}}}
  onPointerLeave={cancel} onPointerCancel={cancel}
  onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();claimUIPress(event.pointerId,event.pointerType,event.buttons);activation.current.press(pick(event.clientX));}}
  onPointerUp={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();const next=activation.current.take(pick(event.clientX));if(next!==undefined)confirm(next);}}>
  <svg viewBox="0 0 160 42" aria-hidden="true"><path d="M1 9V33M1 21H159M159 9V33" fill="none"/>{field.candidates.map(candidate=>{const x=field.max===field.min?80:1+158*(candidate.value-field.min)/(field.max-field.min);return <path key={candidate.id} d={`M${x} ${candidate.thresholds?.length?10:16}V${candidate.thresholds?.length?32:26}`} className={candidate.thresholds?.length?'dof-axis-threshold':undefined}/>;})}</svg>
  <output>{rangeLabel(value)}</output>
 </div>;
}
