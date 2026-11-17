import {useId,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {MathematicalDialSurface,type MathematicalDialProps} from './MathematicalDialSurface.tsx';
import {createMathematicalDialSource} from './mathematicalDialSource.ts';
import {mathematicalDialController as dial} from './mathematicalDialController.ts';
import {MiniMathematicalValue} from './MiniMathematicalValue.tsx';
import {DialReferenceEditor} from './DialReferenceEditor.tsx';
import type {DialField} from '../../../ui/dialReferenceController.ts';
/** Each caller lends its parameter. Only one registered host paints live controls. */
export function MathematicalDial(props:MathematicalDialProps){
 const id=useId(),latest=useRef(props);latest.current=props;
 const [source]=useState(()=>createMathematicalDialSource(id,()=>latest.current)),state=useSyncExternalStore(dial.subscribe,dial.snapshot);
 useLayoutEffect(()=>dial.register(id,source),[id,source]);
 useLayoutEffect(()=>{const external=source.receive();if(external&&dial.snapshot().selection?.owner===id)dial.select(id);dial.refresh(id);},[props.value,props.min,props.max,props.integer,props.label,props.limits?.min,props.limits?.max,props.limits?.hardMin,props.limits?.hardMax,props.editing?.amount]);
 const select=(kind:DialField,target:'value'|'snap'='value',count?:number)=>dial.select(id,kind,target,count);
 if(state.host&&state.host!==id)return <MiniMathematicalValue value={source.field('value').value} label={props.label??'Value'} configuration={source.configuration('value')} onClick={event=>select('value',event.shiftKey?'snap':'value')} formatValue={props.formatValue}/>;
 const selection=state.selection??{owner:id,source,field:'direct' as const,target:'value' as const,generation:0},active=selection.source,p=active.read();
 const renderValue=(kind:'value'|'min'|'max')=>{
  const n=active.field(kind).value;
  const config=active.record(kind).configuration;
  return <MiniMathematicalValue value={n} label={active.field(kind).label} configuration={config?.value===n?config:undefined} prefix={kind==='min'?'⊢':kind==='max'?'⊣':''} active={selection.field===kind} formatValue={kind==='value'?p.formatValue:p.limits?.formatValue} onClick={event=>dial.select(active.id,kind,event.shiftKey?'snap':'value')}/>;
 };
 const retarget=(kind:DialField,target:'value'|'snap',count?:number)=>dial.select(active.id,kind,target,count);
 if(selection.field!=='direct')return <DialReferenceEditor key={`${selection.owner}:${selection.field}:${selection.generation}`} selection={selection} renderValue={renderValue} onReference={retarget}/>;
 const initial=active.configuration('value')??p.initialConfiguration;
 return <MathematicalDialSurface {...p} key={`${selection.owner}:direct:${selection.generation}`} value={active.field('value').value} initialConfiguration={initial} renderValue={renderValue} onReference={retarget}
  onSurfaceCancel={cancel=>dial.attachCancel(active.id,'direct',cancel)}
  onPreview={n=>active.preview('direct',n)} onCancelPreview={()=>active.restore('direct')}
  onConfigurationCommit={cfg=>{active.record('value').configuration=cfg;}}
  onCommit={n=>active.commit('direct',n,active.record('value').configuration)}/>;
}
