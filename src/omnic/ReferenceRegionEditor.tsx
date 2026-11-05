import {useLayoutEffect,useRef,useState,useMemo} from 'react';
import type {DofSettingsKind} from '../ui/DofInformation';
import {createStateField} from '../properties/stateField';
import {DofStateField} from '../ui/DofStateField';
import {DofRegionField} from '../ui/DofRegionField';
import {NumericOperationScope,useNumericEditor} from '../ui/NumericEditorScope';
import {ContextualMasterController} from '../ui/ContextualMasterController';
import {cursorPosition} from '../ui/cursorPosition';
import {LIMITS} from './model';
import {targetNodes} from './contextGeometry';
import {regionReference} from './regionReference';
import {useOperationReferencePicker} from './OperationScope';
import {renderSVG} from './svg';
import type {RegionBounds} from '../properties/regionField';
/** Fill consumes a reference-region projection; it does not generate fractions,
 * semantic thresholds, shape presets or a second numeric configuration store. */
export function ReferenceRegionEditor({targets,configure=false,onDismiss}:{configure?:boolean|DofSettingsKind;targets?:readonly string[];onDismiss?:()=>void}){
 const scope=useOperationReferencePicker(),numeric=useNumericEditor(),owner=useRef(Symbol()),latest=useRef(scope);latest.current=scope;
 const [base]=useState(()=>scope?.snapshot),operation=useRef(crypto.randomUUID());
 const [source,setSource]=useState<{id:string;point:{x:number;y:number}}|undefined>(()=>targets?.length?{id:targets[0],point:cursorPosition()}:undefined);
 const ids=targets??(source?[source.id]:[]),idsKey=ids.join('|');
 const generation=useRef(0),alive=useRef(true),sampled=useRef(false);
 const restore=()=>{if(sampled.current){sampled.current=false;numeric.cancelPreview?.();}};
 const restoreRef=useRef(restore);restoreRef.current=restore;
 const pick=async()=>{restore();const request=++generation.current;const result=await latest.current?.pickRegion(owner.current);if(!alive.current||request!==generation.current)return;if(result)setSource(result);else if(!source)onDismiss?.();return result;};
 useLayoutEffect(()=>{alive.current=true;if(!targets?.length)void pick();return()=>{alive.current=false;generation.current++;latest.current?.cancelPick(owner.current);restoreRef.current();};},[]);
 const reference=useMemo(()=>base&&source?regionReference(base,source.id):undefined,[base,source?.id]);
 const outline=useMemo(()=>{if(!base||!reference)return '';const [x,y]=reference.axes;return renderSVG({...base.evaluation,nodes:reference.nodes,selection:[]},{bounds:{x:x.min,y:y.min,width:x.max-x.min,height:y.max-y.min}});},[base,reference]);
 const regionCapacity=useMemo(()=>base?base.evaluation.nodes.reduce((sum,node)=>sum+(node.fillRegions?.length??0),0)+targetNodes(base.evaluation,ids).filter(node=>node.kind==='dot'||node.kind==='ring').length<=LIMITS.nodes:false,[base,idsKey]);
 const apply=(region:RegionBounds,preview:boolean)=>{
  if(!base||!reference)return;
  if(!regionCapacity){latest.current?.error('Fill region budget exceeded. Remove an existing fill before adding another.');return;}
  if(latest.current?.read()!==base.recipe){restore();latest.current?.error('The construction changed. Reopen Fill to refresh its reference.');onDismiss?.();return;}
  // Never derive the next sample from a previous hover sample.
  const params={fill:true,clipped:true,left:region.x,top:region.y,right:region.x+region.width,bottom:region.y+region.height};
  const next={...base.recipe,operations:[...base.recipe.operations,{id:operation.current,operator:'fill',enabled:true,targets:[...ids],params}]};
  if(latest.current?.commit(next,preview)){sampled.current=preview;if(!preview)onDismiss?.();}
 };
 const operationScope=useMemo(()=>({targets:ids,selection:{self:source?.id===ids[0],pick:async()=>{const result=await pick();return result?{...result,label:result.id,unit:'region',use:'bounds' as const,value:0}:undefined;},clear:()=>{},cancel:()=>latest.current?.cancelPick(owner.current)}}),[idsKey,source?.id]);
 if(!reference||!source)return null;
 return <ContextualMasterController radial anchored dismissOutside position={source.point} title="Fill" onClose={()=>{restore();onDismiss?.();}} onDismiss={()=>{restore();onDismiss?.();}}>
  <NumericOperationScope.Provider value={operationScope}><DofStateField property="omnic.regionFraction" label="Fill" symbol="◐" domain={reference.domain} value={reference.domain.max} execution="scene" configure={configure==='source'?false:configure} onDismiss={onDismiss} onPreview={()=>{}} onCommit={()=>{}}
   executionField={(_field,configuration)=><DofRegionField label="Fill" axes={reference.axes.map(axis=>({...axis,field:createStateField({...reference.domain,thresholds:axis.thresholds},configuration)}))} outline={outline} onPreview={region=>apply(region,true)} onCommit={region=>apply(region,false)} onCancel={restore}/>}/></NumericOperationScope.Provider>
 </ContextualMasterController>;
}
