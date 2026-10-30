import {useContextNavigation} from './ContextStage';
import {useRef,useLayoutEffect,useMemo} from 'react';
import type {StateField} from '../properties/stateField';
import {planeFieldCandidate,sameVector,type VectorValue} from '../properties/vectorStateField';
import {createStateActivation} from '../properties/stateSelection';
import {claimUIPress} from './pointerOwnership';
import {rangeLabel} from './rangeMath';
/** Cartesian projection, independent of property names or object generators. */
export function DofPlaneField({axes,value,label,allowed,onPreview,onCommit,onCancel}:{axes:readonly {property:string;field:StateField}[];value:VectorValue;label:string;allowed:(value:VectorValue)=>boolean;onPreview:(value:VectorValue)=>void;onCommit:(value:VectorValue)=>void;onCancel:()=>void}){
 const root=useRef<HTMLDivElement>(null),bounds=useRef<DOMRect|null>(null),hover=useRef<VectorValue|undefined>(undefined),activation=useRef(createStateActivation<VectorValue>());
 useLayoutEffect(()=>{const node=root.current;if(!node)return;const measure=()=>{bounds.current=node.getBoundingClientRect();};const observer=new ResizeObserver(measure);observer.observe(node);measure();return()=>observer.disconnect();},[]);
 const axesKey=JSON.stringify(axes.map(a=>[a.property,a.field.min,a.field.max,a.field.candidates.map(c=>c.value)]));
 const legality=useMemo(()=>new Map<string,boolean>(),[allowed,axesKey]);
 const pick=(x:number,y:number)=>{const box=bounds.current;return box?planeFieldCandidate(axes,{x:(x-box.left)/box.width,y:(y-box.top)/box.height},value=>{const key=JSON.stringify(value);if(!legality.has(key))legality.set(key,allowed(value));return legality.get(key)!;}):undefined;};
 const cancel=()=>{hover.current=undefined;activation.current.cancel();onCancel();};
 useContextNavigation({owner:root,confirm:()=>{if(hover.current)onCommit(hover.current);}});
 return <div ref={root} className="dof-plane-field" role="group" aria-label={`${label} possibility space`} data-ui-popup-interior
 onPointerEnter={()=>{if(root.current)bounds.current=root.current.getBoundingClientRect();}}
 onPointerMove={event=>{const next=pick(event.clientX,event.clientY);if(next&&(!hover.current||!sameVector(next,hover.current))){hover.current=next;onPreview(next);}else if(!next&&hover.current)cancel();}}
 onPointerLeave={cancel} onPointerCancel={cancel}
 onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();claimUIPress(event.pointerId,event.pointerType,event.buttons);activation.current.press(pick(event.clientX,event.clientY));}}
 onPointerUp={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();const next=activation.current.take(pick(event.clientX,event.clientY));if(next)onCommit(next);}}>
 <svg viewBox="0 0 160 160" aria-hidden="true"><path d="M1 1H159V159H1Z"/>{axes.flatMap((axis,index)=>axis.field.candidates.map(candidate=>{const f=axis.field.max===axis.field.min ? .5 :(candidate.value-axis.field.min)/(axis.field.max-axis.field.min),p=1+158*f;return <path key={`${index}:${candidate.id}`} d={index?`M1 ${p}H159`:`M${p} 1V159`} className={candidate.thresholds?.length?'dof-axis-threshold':undefined}/>;}))}</svg>
 <output>{axes.map(axis=>rangeLabel(value[axis.property])).join(' · ')}</output>
 </div>;
}
