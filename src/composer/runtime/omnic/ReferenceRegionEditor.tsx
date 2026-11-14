import {useLayoutEffect,useRef,useState,useMemo} from 'react';
import type {DofSettingsKind} from '../ui/DofInformation';
import {createStateField} from '../properties/stateField';
import {readRegionShape} from '../properties/regionShape';
import {DofStateField} from '../ui/DofStateField';
import {DofRegionField} from '../ui/DofRegionField';
import {NumericOperationScope,useNumericEditor} from '../ui/NumericEditorScope';
import {ContextualMasterController} from '../ui/ContextualMasterController';
import {UIField} from '../ui/UIField';
import {PropertyEditor} from '../appearance/Controls';
import {cursorPosition} from '../ui/cursorPosition';
import {LIMITS,validateRecipe,type Recipe} from './model';
import {regionAttachmentCandidates,filledRegionShape,resolveFillAttachment,prepareRegionFill,type FillMode} from './fillRegion';
import {ATOMNIC_PARAMETERS} from './atomnicSettings';
import {useOmnicParameterBindings} from './propertyAdapter';
import {regionReference} from './regionReference';
import {useOperationReferencePicker} from './OperationScope';
import {renderSVG} from './svg';
import type {RegionBounds} from '../properties/regionField';
const modeParameter=ATOMNIC_PARAMETERS.find(p=>p.key==='fillMode')!;
/** Shared source/threshold preview; ownership is an explicit continuation when
 * merging against multiple components. Separate mode stores the actual shape. */
export function ReferenceRegionEditor({targets,configure=false,onDismiss}:{configure?:boolean|DofSettingsKind;targets?:readonly string[];onDismiss?:()=>void}){
 const scope=useOperationReferencePicker(),numeric=useNumericEditor(),owner=useRef(Symbol()),attachmentRequest=useRef(Symbol()),latest=useRef(scope);latest.current=scope;
 const [base]=useState(()=>scope?.snapshot),operation=useRef(crypto.randomUUID());
 const [source,setSource]=useState<{id:string;ids:readonly string[];point:{x:number;y:number}}|undefined>(()=>targets?.length?{id:targets[0],ids:targets,point:cursorPosition()}:undefined);
 const [mode,setMode]=useState<FillMode>(()=>base?.recipe.atomnic?.fillMode==='object'?'object':'continuous'),[pendingAttachment,setPendingAttachment]=useState<{region:RegionBounds;candidates:readonly string[]}>();
 const ids=targets??source?.ids??[],idsKey=ids.join('|');
 const generation=useRef(0),attachmentGeneration=useRef(0),alive=useRef(true),sampled=useRef(false);
 const restore=()=>{if(sampled.current){sampled.current=false;numeric.cancelPreview?.();}};
 const restoreRef=useRef(restore);restoreRef.current=restore;
 const pick=async()=>{restore();const request=++generation.current,result=await latest.current?.pickRegion(owner.current);if(!alive.current||request!==generation.current)return;if(result){attachmentGeneration.current++;latest.current?.cancelPick(attachmentRequest.current);contacts.current.clear();cache.current.clear();setPendingAttachment(undefined);setSource(result);}else if(!source)onDismiss?.();return result;};
 const applyRef=useRef<(region:RegionBounds,preview:boolean,chosen?:string)=>boolean>(()=>false);
 const chooseAttachment=async(region:RegionBounds,candidates:readonly string[])=>{restore();setPendingAttachment({region,candidates});const request=++attachmentGeneration.current,result=await latest.current?.pickAttachment(candidates,attachmentRequest.current);if(!alive.current||request!==attachmentGeneration.current)return;setPendingAttachment(undefined);if(result)applyRef.current(region,false,result.id);};
 const changeMode=(value:string|number|boolean)=>{if(value!=='continuous'&&value!=='object')return;restore();attachmentGeneration.current++;latest.current?.cancelPick(attachmentRequest.current);setPendingAttachment(undefined);setMode(value);};
 useOmnicParameterBindings({fillMode:mode},next=>changeMode(next.fillMode),[modeParameter]);
 useLayoutEffect(()=>{alive.current=true;if(!targets?.length)void pick();return()=>{alive.current=false;generation.current++;attachmentGeneration.current++;latest.current?.cancelPick(owner.current);latest.current?.cancelPick(attachmentRequest.current);restoreRef.current();};},[]);

 const reference=useMemo(()=>base&&source?regionReference(base,source.ids):undefined,[base,source?.ids]);
 const outline=useMemo(()=>{if(!base||!reference)return '';const [x,y]=reference.axes;return renderSVG({...base.evaluation,nodes:reference.nodes,selection:[]},{bounds:{x:x.min,y:y.min,width:x.max-x.min,height:y.max-y.min}});},[base,reference]);
 const cache=useRef(new Map<string,{recipe:Recipe;selected:readonly string[]}>()),contacts=useRef(new Map<string,readonly string[]>());
 const apply=(region:RegionBounds,preview:boolean,chosen?:string):boolean=>{
  if(!base||!reference)return false;
  if(latest.current?.read()!==base.recipe){restore();latest.current?.error('The construction changed. Reopen Fill to refresh its reference.');onDismiss?.();return false;}
  try{
   const points=[{x:region.x,y:region.y},{x:region.x+region.width,y:region.y},{x:region.x+region.width,y:region.y+region.height},{x:region.x,y:region.y+region.height}],regionKey=JSON.stringify(region);
   let candidates=contacts.current.get(regionKey);if(!candidates){candidates=regionAttachmentCandidates(base.evaluation,base.owners,ids,filledRegionShape(reference.nodes,points));if(contacts.current.size>=128)contacts.current.delete(contacts.current.keys().next().value!);contacts.current.set(regionKey,candidates);}
   const attachedTo=mode==='continuous'?resolveFillAttachment(candidates,chosen):undefined;
   if(mode==='continuous'&&!preview&&!attachedTo){if(candidates.length>1){void chooseAttachment(region,candidates);return false;}throw Error('This region does not touch a contributing component. Choose another region or Separate object.');}
   const attached=mode==='continuous'&&!!attachedTo,key=JSON.stringify([mode,attachedTo,region]),known=cache.current.get(key);let prepared=known;
   if(!prepared){
    const result=prepareRegionFill(base.evaluation,reference.nodes,points,attached?attachedTo:undefined),shape=readRegionShape(JSON.stringify(result.shape)),text=JSON.stringify(shape);
    if(base.evaluation.nodes.length+shape.length+(!attached?1:0)>LIMITS.nodes)throw Error('Filled region exceeds the current geometry budget.');
    const recipe:Recipe=attached?{...base.recipe,operations:[...base.recipe.operations,{id:operation.current,operator:'fill',enabled:true,targets:[attachedTo!],params:{fill:true,attachment:true,shape:text}}]}:{...base.recipe,components:[...base.recipe.components,{id:operation.current,generator:'region',params:{shape:text,x:result.x!,y:result.y!}}]};
    recipe.atomnic={...recipe.atomnic,fillMode:mode};prepared={recipe:validateRecipe(recipe),selected:[attached?attachedTo!:operation.current]};if(cache.current.size>=128)cache.current.delete(cache.current.keys().next().value!);cache.current.set(key,prepared);
   }
   if(latest.current?.commit(prepared.recipe,preview)){sampled.current=preview;if(!preview){latest.current.selectTargets(prepared.selected);onDismiss?.();}return true;}
  }catch(error){restore();latest.current?.error(error);}
  return false;
 };
 applyRef.current=apply;
 const operationScope=useMemo(()=>({targets:ids,selection:{self:ids.length===1,pick:async()=>{const result=await pick();return result?{...result,label:result.id,unit:'region',use:'bounds' as const,value:0}:undefined;},clear:()=>{},cancel:()=>latest.current?.cancelPick(owner.current)}}),[idsKey,source?.id,mode]);
 if(!reference||!source)return null;
 return <ContextualMasterController radial anchored dismissOutside position={source.point} title="Fill" onClose={()=>{restore();onDismiss?.();}} onDismiss={()=>{restore();onDismiss?.();}}>
  <UIField id="omnic:fill-mode" label="Fill mode" category="Omnic"><PropertyEditor property={modeParameter.property} label="Fill mode" value={mode} choices={modeParameter.options?.map(option=>option.id)} onPreview={changeMode} onCommit={changeMode}/></UIField>
  {pendingAttachment&&<button type="button" title="Pick which component receives this fill; other components retain their identities" aria-label="Choose fill attachment" onClick={()=>pendingAttachment&&void chooseAttachment(pendingAttachment.region,pendingAttachment.candidates)}>⟴ Attach</button>}
  <NumericOperationScope.Provider value={operationScope}><DofStateField property="omnic.regionFraction" label="Fill" symbol="◐" domain={reference.domain} value={reference.domain.max} execution="scene" configure={configure==='source'?false:configure} onDismiss={onDismiss} onPreview={()=>{}} onCommit={()=>{}}
   executionField={(_field,configuration)=>pendingAttachment?null:<DofRegionField label="Fill" axes={reference.axes.map(axis=>({...axis,field:createStateField({...reference.domain,thresholds:axis.thresholds},configuration)}))} outline={outline} onPreview={region=>{apply(region,true);}} onCommit={region=>apply(region,false)} onCancel={restore}/>}/></NumericOperationScope.Provider>
 </ContextualMasterController>;
}
