import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {MathematicalDialSurface} from './MathematicalDialSurface.tsx';
import {createDirectDialDraft,type MathematicalDialSource} from './mathematicalDialSource.ts';
import {mathematicalDialController as dial} from './mathematicalDialController.ts';
import {useActiveLayer} from './ActiveContext.tsx';
import type {DialField} from '../../../ui/dialReferenceController.ts';
/** Marks accumulate in scratch state; only explicit confirmation writes the owner. */
export function DirectDialEditor({source,renderValue,onReference}:{source:MathematicalDialSource;renderValue:(kind:'value'|'min'|'max',n:number)=>ReactNode;onReference:(kind:DialField,target:'value'|'snap',count?:number)=>void}){
 const p=source.read(),root=useRef<HTMLDivElement>(null),[draft,setDraft]=useState(()=>createDirectDialDraft(source)),[version,restart]=useState(0),[,refresh]=useState(0);
 useEffect(()=>()=>draft.cancel(),[draft]);
 useLayoutEffect(()=>dial.attachCancel(source.id,'direct',()=>draft.cancel()),[source,draft]);
 const cancel=()=>{draft.cancel();setDraft(createDirectDialDraft(source));restart(n=>n+1);};
 const finish=()=>{if(draft.accept()){setDraft(createDirectDialDraft(source));restart(n=>n+1);}};
 useActiveLayer(true,root,cancel,undefined,undefined,{confirm:finish});
 return <div ref={root} data-input-owner data-context-controller>
  <MathematicalDialSurface {...p} key={version} value={draft.candidate} initialConfiguration={draft.configuration} renderValue={renderValue} onReference={onReference}
   onPreview={draft.hover} onCancelPreview={draft.restorePreview} onConfigurationCommit={draft.configure} onCommit={n=>{draft.choose(n);refresh(v=>v+1);}}/>
 </div>;
}
