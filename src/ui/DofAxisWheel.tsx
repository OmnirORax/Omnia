import {createCountScrub} from './valueScrub';
import {useValueConfirmation} from './useValueConfirmation';
import {useLayoutEffect,useRef,useSyncExternalStore} from 'react';
import {axisFieldCandidate,type StateField} from '../properties/stateField';
import {createStateActivation} from '../properties/stateSelection';
import {RADIAL_GEOMETRY} from './radialMenuModel';
import {radialScale} from './radialMenuState';
import {rangeLabel} from './rangeMath';
import {claimUIPress,observeUIPress} from './pointerOwnership';
/** The generated angular field is an axis wheel: hover previews, click commits.
 * Values and history remain with DofStateField's existing owner session. */
export function DofAxisWheel({field,value,label,symbol,disabled,onPreview,onCommit,onCancel,onConfigure,selection='single',countDrag,selectedValue=value}:{selectedValue?:number;countDrag?:{unit:number;max:number;value?:number;onPreview:(angle:number,count:number)=>void;onCommit:(angle:number,count:number)=>void;onCancel:()=>void};selection?:'single'|'accumulate';field:StateField;value:number;label:string;symbol:string;disabled:boolean;onPreview:(n:number)=>void;onCommit:(n:number)=>void;onCancel:()=>void;onConfigure:()=>void}){
 const held=useRef<{id:number;angle:number;count?:number;scrub:ReturnType<typeof createCountScrub>;config:NonNullable<typeof countDrag>}|null>(null);
 useLayoutEffect(()=>{const stop=()=>{held.current?.config.onCancel();held.current=null;};window.addEventListener('blur',stop);return()=>{window.removeEventListener('blur',stop);};},[]);
 const root=useRef<HTMLDivElement>(null),bounds=useRef<DOMRect|null>(null),hover=useRef<number|undefined>(undefined),activation=useRef(createStateActivation());
 const scale=useSyncExternalStore(radialScale.subscribe,radialScale.getSnapshot),size=RADIAL_GEOMETRY.minimumSize*6;
 useLayoutEffect(()=>{const node=root.current;if(!node)return;const measure=()=>{bounds.current=node.getBoundingClientRect();};const observer=new ResizeObserver(measure);observer.observe(node);const stop=observeUIPress(active=>{if(!active)measure();});window.addEventListener('resize',measure);measure();return()=>{observer.disconnect();stop();window.removeEventListener('resize',measure);};},[]);
 const cancel=()=>{hover.current=undefined;onCancel();};
 const pick=(x:number,y:number)=>{
  const box=bounds.current;if(disabled||!box)return;
  const point={x:(x-box.left)/box.width*2-1,y:(y-box.top)/box.height*2-1};
  return axisFieldCandidate(field,point)?.value;
 };
 const preview=(next:number|undefined)=>{if(disabled||hover.current===next)return;hover.current=next;if(next===undefined)onCancel();else onPreview(next);};
 const confirm=useValueConfirmation({owner:root,selection,candidate:()=>held.current?undefined:hover.current,onCommit,disabled});
 return <div ref={root} className="radial-menu dof-axis-wheel" role="group" aria-label={`${label} axis wheel`} data-ui-popup-interior style={{width:size*scale,height:size*scale,touchAction:'none'}}
  onPointerEnter={()=>{if(root.current)bounds.current=root.current.getBoundingClientRect();}}
  onPointerMove={event=>{const active=held.current;if(active){if(active.id!==event.pointerId)return;const n=active.scrub.sample({x:event.clientX,y:event.clientY});if(n!==undefined){active.count=n;active.config.onPreview(active.angle,active.count);}return;}preview(pick(event.clientX,event.clientY));}}
  onPointerLeave={()=>{if(held.current)return;activation.current.cancel();cancel();}}
  onPointerCancel={()=>{held.current?.config.onCancel();held.current=null;activation.current.cancel();cancel();}}
  onLostPointerCapture={()=>{if(held.current){held.current.config.onCancel();held.current=null;}}}
  onBlur={event=>{if(!(event.relatedTarget instanceof Node)||!event.currentTarget.contains(event.relatedTarget))cancel();}}
  onPointerDownCapture={event=>{if(event.button!==0||disabled||(event.target instanceof Element&&event.target.closest('[data-dial-drag]')))return;event.stopPropagation();event.preventDefault();claimUIPress(event.pointerId,event.pointerType,event.buttons);const angle=pick(event.clientX,event.clientY);activation.current.press(angle);
   if(countDrag&&angle!==undefined){held.current={id:event.pointerId,angle,config:countDrag,scrub:createCountScrub({x:event.clientX,y:event.clientY},countDrag.unit,countDrag.max)};event.currentTarget.setPointerCapture(event.pointerId);}}}
  onPointerUp={event=>{if(event.button!==0||disabled||(event.target instanceof Element&&event.target.closest('[data-dial-drag]')))return;event.preventDefault();event.stopPropagation();const active=held.current;if(active){held.current=null;activation.current.cancel();active.config.onCancel();active.config.onCommit(active.angle,active.scrub.sample({x:event.clientX,y:event.clientY})??active.count??1);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);return;}const next=activation.current.take(pick(event.clientX,event.clientY));if(next!==undefined)confirm(next);}}
  onClick={event=>{if(disabled||(event.target instanceof Element&&event.target.closest('[data-dial-drag]')))return;event.preventDefault();event.stopPropagation();}}
  onContextMenu={event=>{event.preventDefault();event.stopPropagation();held.current?.config.onCancel();held.current=null;activation.current.cancel();cancel();onConfigure();}}>
  <svg className="radial-menu-rims" viewBox="-1 -1 2 2" aria-hidden="true"><circle r=".8"/>{field.candidates.map(candidate=><line className={candidate.thresholds?.length?"dof-axis-threshold":undefined} data-selected={Math.abs(candidate.value-selectedValue)<1e-7} data-preview={Math.abs(candidate.value-value)<1e-7} key={candidate.id} x1="0" y1="0" x2={candidate.point.x} y2={candidate.point.y} vectorEffect="non-scaling-stroke"/>)}</svg>
  <span className="dof-axis-origin" data-dial-drag role="button" tabIndex={0} title="Move wheel" aria-label="Move wheel" style={{width:RADIAL_GEOMETRY.minimumSize*scale,height:RADIAL_GEOMETRY.minimumSize*scale}}>{symbol}</span>
  <output className="dof-axis-readout" title={String(value)}>{field.candidates.length?`${rangeLabel(value)}°${countDrag?.value!==undefined?` · ${countDrag.value}`:''}`:'∅'}</output>
 </div>;
}
