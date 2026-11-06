import {useLayoutEffect,useRef,useState} from 'react';
import {regionThresholdCandidate,regionThresholdAnchor,regionAxisValues,type RegionAnchor,type RegionAxis,type RegionBounds} from '../properties/regionField';
import {claimUIPress} from './pointerOwnership';
import {useValueConfirmation} from './useValueConfirmation';
/** Shared coordinate-region projection. Outline is supplied by the reference
 * renderer; threshold values come exclusively from prepared fields. */
export function DofRegionField({axes,outline,label='Region',onPreview,onCommit,onCancel}:{label?:string;axes:readonly RegionAxis[];outline:string;onPreview:(region:RegionBounds)=>void;onCommit:(region:RegionBounds)=>void|boolean;onCancel:()=>void}){
 const [sample,setSample]=useState<RegionBounds>();
 const root=useRef<HTMLDivElement>(null),bounds=useRef<DOMRect|null>(null),hover=useRef<RegionBounds|undefined>(undefined),pressed=useRef(false),anchor=useRef<RegionAnchor|undefined>(undefined);
 useLayoutEffect(()=>{const node=root.current;if(!node)return;const measure=()=>{bounds.current=node.getBoundingClientRect();};const observer=new ResizeObserver(measure);observer.observe(node);measure();return()=>observer.disconnect();},[]);
 const point=(x:number,y:number)=>{const box=bounds.current;if(!box)return;const clamp=(n:number)=>pressed.current?Math.max(0,Math.min(1,n)):n;return {x:clamp((x-box.left)/box.width),y:clamp((y-box.top)/box.height)};};
 const pick=(x:number,y:number)=>{const p=point(x,y);return p?regionThresholdCandidate(axes,p,anchor.current):undefined;};
 const cancel=()=>{hover.current=undefined;pressed.current=false;anchor.current=undefined;setSample(undefined);onCancel();};
 const cleanup=useRef(onCancel);cleanup.current=onCancel;
 useLayoutEffect(()=>()=>cleanup.current(),[]);
 const confirm=useValueConfirmation({owner:root,selection:'single',candidate:()=>hover.current,onCommit});
 const x=axes[0],y=axes[1];
 return <div ref={root} className="dof-region-field" role="group" aria-label={`${label} reference thresholds`} data-ui-popup-interior title="Hover near a reference boundary to preview a region ending at a generated threshold; click or Enter to apply; drag from that side across thresholds to extend the region"
 onPointerEnter={()=>{if(root.current)bounds.current=root.current.getBoundingClientRect();}}
 onPointerMove={event=>{const next=pick(event.clientX,event.clientY);if(next){if(JSON.stringify(next)!==JSON.stringify(hover.current)){hover.current=next;setSample(next);onPreview(next);}}else if(hover.current){hover.current=undefined;setSample(undefined);onCancel();}}}
 onPointerLeave={()=>{if(!pressed.current)cancel();}} onPointerCancel={cancel} onLostPointerCapture={()=>{if(pressed.current)cancel();}}
 onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();claimUIPress(event.pointerId,event.pointerType,event.buttons);const p=point(event.clientX,event.clientY);anchor.current=p?regionThresholdAnchor(p):undefined;pressed.current=true;event.currentTarget.setPointerCapture(event.pointerId);hover.current=pick(event.clientX,event.clientY);}}
 onPointerUp={event=>{if(event.button!==0||!pressed.current)return;event.preventDefault();event.stopPropagation();const next=pick(event.clientX,event.clientY);pressed.current=false;anchor.current=undefined;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);if(next)confirm(next);}}>
 <div className="dof-region-outline" dangerouslySetInnerHTML={{__html:outline}}/>
 <svg viewBox={`${x.min} ${y.min} ${x.max-x.min} ${y.max-y.min}`} preserveAspectRatio="none" aria-hidden="true">{sample&&<rect x={sample.x} y={sample.y} width={sample.width} height={sample.height} fill="currentColor" fillOpacity=".15"/>}{axes.flatMap((axis,index)=>regionAxisValues(axis).map(value=><path key={`${index}:${value}`} d={index?`M${x.min} ${value}H${x.max}`:`M${value} ${y.min}V${y.max}`} vectorEffect="non-scaling-stroke"/>))}</svg>
 </div>;
}
