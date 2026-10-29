import { RENDER_BUDGET } from '../renderBudget';
import { useMemo, useRef, useSyncExternalStore, type RefObject } from 'react';
import { useContextTargets } from '../ui/useContextTargets';
import { contextTargets, type ContextTarget, type CommandDegree, type TargetCommand } from '../ui/contextTargets';
import { targetDegrees, targetDegreeValue, writeTargetDegree, targetParameter } from './targetDegrees';
import type { EditableDegree } from '../properties/editableDegrees';
import { useOmnicParameterBindings } from './propertyAdapter';
import { atomnicSettings } from './atomnic';
import { checkedParameter } from './omnic.function';
import { componentIndex, deleteComponents, rootTargets, memberTargets } from './componentTargets';
import { compactGeometry, targetBounds, targetLevels, fitDegreeValue } from './contextGeometry';
import { resizeLevels, type ResizeRect } from '../ui/resizeGeometry';
import { atomnicViewBounds } from './atomnicSettings';
import type { Recipe, RecipeResolver } from './model';
import { evaluateRecipe, type Evaluation } from './evaluate';
import type { AtomnicInteraction } from './atomnicInteraction';

type Props={recipe:Recipe;resolve?:RecipeResolver;evaluation:Evaluation|null;selection:readonly string[];select:(ids:readonly string[])=>void;commit:(recipe:Recipe,preview?:boolean)=>boolean;surface:RefObject<HTMLDivElement|null>;bridge:AtomnicInteraction|null;error:(message:string)=>void;};
/** Geometry supplies capabilities and setters, never a second MC/shortcut implementation. */
export function useContextCommands(props:Props){
  const latest=useRef(props);latest.current=props;
  const memory=useRef(new Map<string,{before:string|number|boolean;after:string|number|boolean}>());
  const levels=useMemo(()=>targetLevels(props.recipe,props.selection.length?props.selection:props.recipe.components.map(c=>c.id)),[props.recipe.components,props.selection]);
  const signature=useMemo(()=>props.selection.join('|')+':'+[...componentIndex(props.recipe)].map(([id,{component,parent}])=>`${id}:${component.generator}:${parent??''}`).join('|')+`:${props.recipe.atomnic?.active}:${props.recipe.atomnic?.mode}`,[props.selection,props.recipe.components,props.recipe.atomnic]);
  const prepared=useMemo<ContextTarget[]>(()=>{
    if(!props.recipe.components.length||!props.evaluation)return [];
    const attempt=(run:()=>void)=>()=>{try{run();}catch(failure){latest.current.error(failure instanceof Error?failure.message:String(failure));}};
    const select=(ids:readonly string[])=>{latest.current.bridge?.select?.(ids);latest.current.select(ids);};
    const view=():ResizeRect=>atomnicViewBounds(latest.current.recipe.atomnic)??{x:-100,y:-100,width:200,height:200};
    const setDegree=(degree:EditableDegree,value:string|number|boolean)=>{
      const current=latest.current.recipe,parameter=targetParameter(degree);
      const next=writeTargetDegree(current,degree,checkedParameter(parameter,value));evaluateRecipe(next,latest.current.resolve);return latest.current.commit(next);
    };
    const toggle=(key:string,degree:EditableDegree,desired:()=>number)=>attempt(()=>{
      const before=targetDegreeValue(latest.current.recipe,degree),saved=memory.current.get(key);
      if(saved&&before===saved.after){setDegree(degree,saved.before);memory.current.delete(key);return;}
      const parameter=targetParameter(degree),next=checkedParameter(parameter,desired());
      if(setDegree(degree,next)){memory.current.set(key,{before,after:next});if(memory.current.size>128)memory.current.delete(memory.current.keys().next().value!);}
    });
    return levels.map((ids,index)=>{
      const fixed=props.recipe.atomnic?.active&&atomnicSettings(props.recipe).mode==='constrained'?['omnic.extent']:[];
      const members=memberTargets(props.recipe,ids),group=ids.some(id=>componentIndex(props.recipe).get(id)?.component.generator==='group');
      const degrees=targetDegrees(props.recipe,members,[],fixed,group?'available':'common'),numeric=degrees.filter(d=>targetParameter(d).kind==='number');
      const lengths=numeric.filter(d=>targetParameter(d).unit==='length');
      const candidates=(list:EditableDegree[],run:(degree:EditableDegree)=>()=>void):CommandDegree[]=>list.map(degree=>({id:degree.id,label:degree.label,symbol:degree.symbol,value:targetDegreeValue(props.recipe,degree),run:run(degree)}));
      const resize:TargetCommand={degrees:candidates(lengths,degree=>toggle(`fit:${ids.join('|')}:${degree.id}`,degree,()=>{
        const current=latest.current,evaluation=current.evaluation!;
        const bounds=targetBounds(evaluation,ids);if(!bounds)throw Error('No visible geometry to resize.');
        const selected=new Set(rootTargets(current.recipe,ids));
        const components=componentIndex(current.recipe),parents=new Set([...selected].map(id=>components.get(id)?.parent));
        const neighbours=[...components].filter(([id,item])=>parents.has(item.parent)&&!selected.has(id)).flatMap(([id])=>{const b=targetBounds(evaluation,[id]);return b?[b]:[];});
        const parent=parents.size===1?[...parents][0]:undefined,area=parent?targetBounds(evaluation,[parent])??view():view();
        const target=resizeLevels(bounds,neighbours,area)[0];
        return fitDegreeValue(current.recipe,evaluation,degree,ids,target,current.resolve);
      })),available:lengths.length>0&&props.evaluation!.nodes.length<=RENDER_BUDGET.omnicAnimatedRoles};
      const expand:TargetCommand={degrees:candidates(numeric,degree=>toggle(`inflate:${ids.join('|')}:${degree.id}`,degree,()=>{
        const value=Number(targetDegreeValue(latest.current.recipe,degree)),parameter=targetParameter(degree);
        const expanded=checkedParameter(parameter,value===0?Number(parameter.step??1):value*2);
        return expanded===value?value/2:Number(expanded);
      })),available:numeric.length>0};
      const focus=attempt(()=>{const current=latest.current,bounds=targetBounds(current.evaluation!,ids);if(!bounds)return;
        current.commit({...current.recipe,atomnic:{...current.recipe.atomnic,viewX:Math.max(-10000,Math.min(10000,bounds.x+bounds.width/2)),viewY:Math.max(-10000,Math.min(10000,bounds.y+bounds.height/2)),viewSize:Math.max(40,Math.min(1000,Math.max(bounds.width,bounds.height)+24))}});
      });
      const remove=attempt(()=>{const current=latest.current;if(current.commit(deleteComponents(current.recipe,new Set(ids))))select([]);});
      const compact=attempt(()=>{const current=latest.current;current.commit(compactGeometry(current.recipe,current.evaluation!,ids,view()));});
      const count=ids.length===1?componentIndex(props.recipe).get(ids[0])?.component.children?.length??1:ids.length;
      const commands:Record<string,TargetCommand>={
        deleteSelected:{run:remove,available:props.selection.length>0},focus:{run:focus},'context.back':{run:()=>{if(!props.selection.length)contextTargets.clear();else select(index+1<levels.length?levels[index+1]:[]);}},
        'context.minimize':resize,'context.resize':resize,
        'context.descendants':expand,expand,expandAll:expand,
        compactAll:{run:compact,available:count>1&&count<=32},compactSelected:{run:compact,available:count>1&&count<=32},compactFrame:{run:compact,available:count>1&&count<=32},'ui:compact':{run:compact,available:count>1&&count<=32},
        selectAll:{run:()=>select(latest.current.recipe.components.map(c=>c.id))},
      };
      return {id:ids.join('|'),label:!props.selection.length?'Composition':index?`Parent scope · ${ids.length}`:`Geometry · ${ids.length} selected`,commands};
    });
  },[props.recipe,props.selection,props.evaluation,levels]);
  const preparedRef=useRef(prepared);preparedRef.current=prepared;
  const activate=useContextTargets(props.surface,()=>preparedRef.current,signature);
  useSyncExternalStore(contextTargets.subscribe,contextTargets.getSnapshot);
  const active=contextTargets.isSource(props.surface.current);
  const bindingDegrees=useMemo(()=>active&&props.selection.length?targetDegrees(props.recipe,memberTargets(props.recipe,props.selection),[],props.recipe.atomnic?.active&&atomnicSettings(props.recipe).mode==='constrained'?['omnic.extent']:[],props.selection.some(id=>componentIndex(props.recipe).get(id)?.component.generator==='group')?'available':'common'):[],[active,props.recipe,props.selection]);
  const parameters=useMemo(()=>bindingDegrees.map(targetParameter),[bindingDegrees]);
  const values=useMemo(()=>Object.fromEntries(bindingDegrees.map(degree=>[degree.targets[0].input.key,targetDegreeValue(props.recipe,degree)])),[bindingDegrees,props.recipe]);
  useOmnicParameterBindings(values,next=>{
    try{let recipe=latest.current.recipe;for(const degree of bindingDegrees){const key=degree.targets[0].input.key;if(next[key]!==values[key])recipe=writeTargetDegree(recipe,degree,next[key]);}if(recipe!==latest.current.recipe)latest.current.commit(recipe);}
    catch(failure){latest.current.error(failure instanceof Error?failure.message:String(failure));}
  },parameters);
  return {activate,active};
}
