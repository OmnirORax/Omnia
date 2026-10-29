import { radialTree } from './radialMenuModel';
import { useSyncExternalStore, useState, useRef, useContext, useMemo } from 'react';
import { PROPERTY_REGISTRY } from '../appearance/registry';
import { preparePropertyChanges } from '../properties/registry';
import { ConfigurationInteractionContext, useConfigurationInteraction } from './ConfigurationInteraction';
import { contextTargets } from './contextTargets';
import { ContextualMasterController } from './ContextualMasterController';
import { RadialMenu } from './RadialMenu';
import { cursorPosition } from './cursorPosition';
import { nameSymbol } from './nameSymbols';
/** All target adapters inherit one ambiguity prompt; no environment-specific picker. */
export function ContextTargetController(){
  const choice=useSyncExternalStore(contextTargets.choice.subscribe,contextTargets.choice.getSnapshot);
  const close=()=>contextTargets.choice.set(null);
  const position=useMemo(()=>choice?cursorPosition():null,[choice]);
  return <ContextualMasterController title="Choose DOF" radial position={position} onClose={close}>
    {choice&&<RadialMenu items={radialTree(choice.degrees.map(degree=>({group:degree.group,id:degree.id,label:degree.label,symbol:degree.symbol??nameSymbol(degree.id,degree.label),content:<button type="button" title={`${degree.label}${degree.value===undefined?'':` · ${degree.value}`}`} aria-label={degree.label} onClick={()=>contextTargets.choose(degree.id)}>{degree.symbol??nameSymbol(degree.id,degree.label)}</button>})))} onClose={close}/>}
  </ContextualMasterController>;
}

/** Shift cycles the same detected choices; release applies the current one. */
export function ContextDOFConfiguration({action}:{action:string}){
  const resolved=contextTargets.resolve(action),degrees=resolved?.command.degrees??[];
  const bindings=useContext(ConfigurationInteractionContext)?.bindings;
  const initial=Math.max(0,Math.min(degrees.length-1,Number(bindings?.values['ui.target.choice']?.['operation.level']??1)-1));
  const [index,setIndex]=useState(initial),current=useRef(initial);
  const save=(value:number)=>bindings?.commit(preparePropertyChanges(PROPERTY_REGISTRY,'operation.level',value,['ui.target.choice']));
  const select=(next:number)=>{current.current=Math.max(0,Math.min(degrees.length-1,next));setIndex(current.current);};
  useConfigurationInteraction({cycle:()=>select((current.current+1)%Math.max(1,degrees.length)),select,apply:()=>{const live=contextTargets.resolve(action),degree=degrees[current.current];if(live?.target.id===resolved?.target.id)live?.command.degrees?.find(candidate=>candidate.id===degree?.id)?.run();},lock:()=>save(current.current+1),reset:()=>{select(0);save(1);}});
  return <div className="progressive-navigation">{degrees.map((degree,i)=><button key={degree.id} type="button" data-configuration-option={i} aria-pressed={i===index} title={degree.label}>{degree.label}</button>)}</div>;
}
