import {activeWindowOwns} from '../../../ui/windowDismissal.ts';
import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react';
import {MathematicalDial} from './MathematicalDial.tsx';
import {createDialValueDraft,dialValueGrid,dialGridCount,dialSnapDomain} from '../../../properties/dialValueGrid.ts';
import type {MathematicalDomain,MathematicalScaleMode} from '../../../properties/mathematicalDial.ts';
import type {ConfirmedMathValue} from '../../../ui/operationNumber.ts';
import {reportSystemMessage} from '../../../ui/systemMessage.ts';
export type DialValueEditorHandle={confirm:()=>void};
export function DialValueEditor({value,domain,label,snap,configuration,snapConfiguration,initialTarget='value',initialCount,editorRef,onPreview,onRestore,onCommit,onSnapCommit,onReject=reportSystemMessage}:{value:number;domain:MathematicalDomain;label:string;snap?:number;configuration?:ConfirmedMathValue;snapConfiguration?:ConfirmedMathValue;initialTarget?:'value'|'snap';initialCount?:number;editorRef:Ref<DialValueEditorHandle>;onPreview:(n:number)=>void;onRestore:()=>void;onCommit:(n:number,config?:ConfirmedMathValue)=>void|boolean;onSnapCommit:(n:number,config?:ConfirmedMathValue)=>void;onReject?:(message:string)=>void}){
 const root=useRef<HTMLDivElement>(null);
 const callbacks=useRef({onPreview,onRestore,onCommit,onSnapCommit});callbacks.current={onPreview,onRestore,onCommit,onSnapCommit};
 const snapConfig=useRef<ConfirmedMathValue|undefined>(snapConfiguration),config=useRef<ConfirmedMathValue|undefined>(configuration),[draft]=useState(()=>createDialValueDraft({domain,value,snap,represented:!!configuration,preview:n=>callbacks.current.onPreview(n),restore:()=>callbacks.current.onRestore(),commit:n=>callbacks.current.onCommit(n,config.current)}));
 if(!config.current)config.current={mode:'value',anchor:draft.candidate,count:dialGridCount(draft.grid,draft.candidate),value:draft.candidate,equilibrium:draft.grid.equilibrium,snap:draft.grid.snap};
 const [target,setTarget]=useState(initialTarget),[,refresh]=useState(0),[countText,setCountText]=useState(initialCount!==undefined?String(initialCount):(initialTarget==='snap'?snapConfiguration:configuration)?String(Math.abs((initialTarget==='snap'?snapConfiguration:configuration)!.count)):'');
 const [mode,setMode]=useState<MathematicalScaleMode>((initialTarget==='snap'?snapConfiguration:configuration)?.mode??'value');
 const span=domain.max-domain.min,snapDomain=dialSnapDomain(domain);
 const confirm=()=>{if(target==='snap'){callbacks.current.onSnapCommit(draft.grid.snap,snapConfig.current);switchTarget('value');return;}if(!config.current)config.current={mode:'value',anchor:draft.candidate,count:dialGridCount(draft.grid,draft.candidate),value:draft.candidate,equilibrium:draft.grid.equilibrium,snap:draft.grid.snap};if(draft.accept())callbacks.current.onSnapCommit(draft.grid.snap,snapConfig.current);else onReject(`${label}: no selectable value within these limits.`);};
 useImperativeHandle(editorRef,()=>({confirm}));
 useEffect(()=>()=>draft.cancel(),[draft]);
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(!root.current||!activeWindowOwns(root.current)||event.ctrlKey||event.metaKey||event.altKey||event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable]'))return;if(event.key==='.'||event.key===','){event.preventDefault();event.stopImmediatePropagation();onReject('Use whole snap counts; configure fractions with Snap or 1/x.');return;}if(!/^\d$/.test(event.key)&&event.key!=='Backspace')return;event.preventDefault();event.stopImmediatePropagation();setCountText(before=>{const text=event.key==='Backspace'?before.slice(0,-1):before+event.key;if(text&&(!Number.isSafeInteger(Number(text))||Number(text)<0)){onReject('Count exceeds safe numeric precision.');return before;}return text;});};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[onReject]);
 const switchTarget=(next:'value'|'snap')=>{draft.restorePreview();setTarget(next);const saved=next==='value'?config.current:snapConfig.current;setMode(saved?.mode??'value');setCountText(saved?String(Math.abs(saved.count)):'');};
 const numeric=target==='value'?domain:snapDomain;
 return <div ref={root} data-dial-value-editor data-input-owner onPointerDownCapture={event=>{if(event.target instanceof Element&&event.target.closest('[data-dial-value-editor]')===root.current&&event.target.closest('[data-math-slot]'))setCountText('');}}>
  <nav className="dial-value-target" aria-label="Edit target">{(['value','snap'] as const).map(next=><button type="button" key={next} aria-pressed={target===next} onClick={()=>switchTarget(next)}>{next==='value'?'Value':'Snap'}</button>)}</nav>
  {target==='value'&&value!==draft.candidate&&!draft.finished&&<output className="dial-value-rounding" aria-label="Proposed value">{Number(value.toPrecision(6))} → {Number(draft.candidate.toPrecision(6))}</output>}
  <MathematicalDial key={target} label={`${label} ${target}`} value={target==='value'?draft.candidate:draft.grid.snap} min={numeric.min} max={numeric.max} integer={numeric.integer}
   initialConfiguration={target==='value'?config.current:snapConfig.current} grid={target==='value'?draft.grid:dialValueGrid(snapDomain)} scaleStart={target==='value'?draft.candidate:span} typedCount={countText?Number(countText):undefined}
   onModeChange={next=>{setMode(next);setCountText('');}} onConfigurationCommit={next=>{if(target==='value')config.current=next;else snapConfig.current=next;}}
   onPreview={target==='value'?draft.hover:()=>{}} onCancelPreview={target==='value'?draft.restorePreview:()=>{}}
   onCommit={n=>{if(target==='value'){draft.choose(n);refresh(v=>v+1);}else if(draft.setSnap(n)){config.current=undefined;refresh(v=>v+1);}else onReject('Snap must be positive and match this value’s numeric type.');}} onReject={onReject}/>
  <output className="dial-value-equation" aria-label="Value calculation">{target==='value'&&mode==='value'?`${draft.grid.equilibrium} ${'±'} n × ${draft.grid.snap}`:target==='snap'?`Snap: ${draft.grid.snap}`:undefined}</output>
 </div>;
}
