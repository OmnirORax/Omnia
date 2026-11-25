import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {MathematicalDialSurface} from './MathematicalDialSurface.tsx';
import {dialValueGrid,dialSnapDomain} from '../../../properties/dialValueGrid.ts';
import type {MathematicalScaleMode} from '../../../properties/mathematicalDial.ts';
import {activeWindowOwns} from '../../../ui/windowDismissal.ts';
import {useActiveLayer} from './ActiveContext.tsx';
import {mathematicalDialController as dial} from './mathematicalDialController.ts';
import type {DialField,DialSelection} from '../../../ui/dialReferenceController.ts';
import {createDialEditorDraft,type MathematicalDialSource} from './mathematicalDialSource.ts';
import {reportSystemMessage} from '../../../ui/systemMessage.ts';
export function DialReferenceEditor({selection,renderValue,onReference}:{selection:DialSelection<MathematicalDialSource>;renderValue:(kind:'value'|'min'|'max',value:number)=>ReactNode;onReference:(kind:DialField,target:'value'|'snap',count?:number)=>void}){
 const {source,field}=selection,p=source.read(),initial=useRef(source.field(field)).current,root=useRef<HTMLDivElement>(null);
 const [draft]=useState(()=>createDialEditorDraft(source,field));
 const [target,setTarget]=useState(selection.target),[,refresh]=useState(0),[countText,setCountText]=useState(selection.initialCount===undefined?'':String(selection.initialCount));
 const [mode,setMode]=useState<MathematicalScaleMode>((selection.target==='value'?draft.configuration:draft.snapConfiguration)?.mode??'value'),onReject=p.onReject??reportSystemMessage;
 const switchTarget=(next:'value'|'snap')=>{if(next===target)return;draft.restorePreview();setTarget(next);setMode((next==='value'?draft.configuration:draft.snapConfiguration)?.mode??'value');setCountText('');};
 useEffect(()=>{switchTarget(selection.target);},[selection.target]);
 useLayoutEffect(()=>dial.attachCancel(source.id,field,()=>draft.cancel()),[source,field,draft]);
 useEffect(()=>()=>draft.cancel(),[draft]);
 const saveSnap=draft.saveSnap;
 const finish=()=>{if(target==='snap'){saveSnap();dial.select(source.id,field,'value');return;}if(draft.accept()){saveSnap();dial.select(source.id);} };
 const cancel=()=>{draft.cancel();dial.select(source.id);};
 useActiveLayer(true,root,cancel,undefined,undefined,{confirm:finish});
 useEffect(()=>{if(field==='direct'&&target==='value')return;const key=(event:KeyboardEvent)=>{if(!root.current||!activeWindowOwns(root.current)||event.ctrlKey||event.metaKey||event.altKey||event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable]'))return;if(event.key==='.'||event.key===','){event.preventDefault();event.stopImmediatePropagation();onReject('Use whole snap counts; configure fractions with Snap or 1/x.');return;}if(!/^\d$/.test(event.key)&&event.key!=='Backspace')return;event.preventDefault();event.stopImmediatePropagation();setCountText(before=>{const text=event.key==='Backspace'?before.slice(0,-1):before+event.key;if(text&&!Number.isSafeInteger(Number(text))){onReject('Count exceeds safe numeric precision.');return before;}return text;});};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[onReject,field,target]);
 const span=initial.domain.max-initial.domain.min,snapDomain=dialSnapDomain(initial.domain),numeric=target==='value'?initial.domain:snapDomain;
 return <div ref={root} data-dial-value-editor data-input-owner data-context-controller onPointerDownCapture={event=>{if(event.target instanceof Element&&event.target.closest('[data-math-slot]'))setCountText('');}}>
  <nav className="dial-value-target" aria-label={`Editing ${initial.label}`}>{(['value','snap'] as const).map(next=><button type="button" key={next} aria-pressed={target===next} onClick={()=>dial.select(source.id,field,next)}>{next==='value'?'Value':'Snap'}</button>)}</nav>
  {field!=='direct'&&target==='value'&&initial.value!==draft.candidate&&!draft.finished&&<output className="dial-value-rounding">{Number(initial.value.toPrecision(6))} → {Number(draft.candidate.toPrecision(6))}</output>}
  <MathematicalDialSurface {...(field==='direct'&&target==='value'?p:{})} key={target} label={initial.label} value={target==='value'?draft.candidate:draft.grid.snap} min={numeric.min} max={numeric.max} integer={numeric.integer} limits={p.limits} modeControl={p.modeControl} renderValue={renderValue} onReference={onReference}
   initialConfiguration={target==='value'?draft.configuration:draft.snapConfiguration} grid={target==='value'?draft.valueGrid:dialValueGrid(snapDomain)} scaleStart={p.scaleStart??(target==='value'?draft.candidate:span)} typedCount={countText?Number(countText):field==='direct'&&target==='value'?p.typedCount:undefined}
   onModeChange={next=>{setMode(next);setCountText('');if(field==='direct'&&target==='value')p.onModeChange?.(next);}} onConfigurationCommit={next=>{if(target==='value')draft.configure(next);else draft.configureSnap(next);}}
   onPreview={target==='value'?draft.hover:()=>{}} onCancelPreview={target==='value'?draft.restorePreview:()=>{}}
   onCommit={n=>{if(target==='value'){draft.choose(n);refresh(v=>v+1);}else if(draft.setSnap(n)){refresh(v=>v+1);}else onReject('Snap must be positive and match this value’s numeric type.');}} onReject={onReject}/>
  <output className="dial-value-equation">{target==='value'&&mode==='value'&&draft.valueGrid?`${draft.grid.equilibrium} ± n × ${draft.grid.snap}`:target==='snap'?`Snap: ${draft.grid.snap}`:undefined}</output>
 </div>;
}
