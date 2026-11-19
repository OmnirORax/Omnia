import {selectionLatch} from './selectionLatch.ts';
import {releaseShortcuts} from './releaseShortcuts.ts';
import {shortcuts,capturingShortcut,type ShortcutDefinition} from './shortcuts.ts';
import {pointerCombo} from './activationCombo.ts';
export type PointerBinding=ShortcutDefinition&{activation:true;context:string};
const make=(id:string,label:string,combo:string,context='world',category:'Omnium'|'Document'='Omnium'):PointerBinding=>({id:`gesture:${id}`,label,defaultKey:combo,category,activation:true,context,gesture:label.includes('box')?'Drag':undefined,keywords:label.includes('box')?'multi selection multiselect multiple rectangle ctrl drag':'',scope:`pointer:${context}`});
export const POINTER_BINDINGS=[
 make('multi-plane','Select / select box · plane','Ctrl+MB1'),make('multi-depth','Select box · depth','Ctrl+Shift+MB1'),
 make('connect','Connect nodes','Shift+MB1'),make('camera-rotate','Rotate camera','Shift+MB2'),make('move','Move / parent / reconnect / toggle axes','MB1'),make('menu','Context menu / navigate camera','MB2'),
 make('face-origin','Aim origin','Alt+MB2'),make('paint-confirm','Confirm paint preview','Alt+MB1'),
 make('rotate','Rotate / aim / confirm','MB3'),make('origin-rotation','Rotate origin','X+MB3'),
 make('create-place','Place / paint nodes','MB1','create'),make('create-secondary','Place node · alternate','MB2','create'),
 make('alignment-direction','Turn alignment','MB2','align'),make('zoom','Zoom / adjust selection depth','Wheel'),
 make('cursor','Add cursor / word / text selection','Alt+MB1','document','Document'),
];
export function resolvePointerBinding(combo:string,context:string,read=(definition:ShortcutDefinition)=>shortcuts.get(definition)){
 const candidates=POINTER_BINDINGS.filter(item=>item.context===context||context==='create'&&item.context==='world'&&['gesture:multi-plane','gesture:multi-depth','gesture:paint-confirm','gesture:camera-rotate','gesture:rotate','gesture:origin-rotation','gesture:zoom'].includes(item.id));
 const action=candidates.find(item=>read(item)===combo);return action?{id:action.id,combo:action.defaultKey}:undefined;
}
let activeAction:string|undefined;
export const pointerActivation=()=>activeAction;
/** Translate the activation at the input boundary; existing owners retain their
 * drag, preview, acceptance and cancellation lifecycle. */
export function installPointerBindings(context:()=>string){
 const held=new Set<string>(),drags=new Map<number,{combo:string;id:string}>();
 window.addEventListener('keydown',event=>{if(!capturingShortcut()&&!(event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable],.cm-editor,[data-input-owner]'))){if(event.key==='Escape')selectionLatch.clear();else if(!event.repeat){if(['Control','Meta','Shift'].includes(event.key))selectionLatch.press(event.key);else selectionLatch.use();}}if(event.key.length===1&&!event.repeat){held.add(event.key.toUpperCase());pressed.add(event.key.toUpperCase());}},true);
 window.addEventListener('keyup',event=>{selectionLatch.release(event.key);held.delete(event.key.toUpperCase());pressed.delete(event.key.toUpperCase());},true);
 window.addEventListener('blur',()=>{selectionLatch.clear();held.clear();pressed.clear();drags.clear();activeAction=undefined;});
 const apply=(event:MouseEvent,combo:string)=>{if(!('activationPhysicalButton' in event))Object.defineProperty(event,'activationPhysicalButton',{value:event.button});const parts=combo.split('+'),button=parts.at(-1),values={ctrlKey:parts.includes('Ctrl'),metaKey:false,altKey:parts.includes('Alt'),shiftKey:parts.includes('Shift'),...(button?.startsWith('MB')?{button:button==='MB1'?0:button==='MB2'?2:1}:{})};for(const [key,value]of Object.entries(values))Object.defineProperty(event,key,{value,configurable:true});};
 window.addEventListener('pointerdown',event=>{
  selectionLatch.use();
  if(capturingShortcut()||!(event.target instanceof Element)||event.target.closest('.shortcut-capture')||!event.target.closest('#world,.cm-content'))return;
  const doc=!!event.target.closest('.cm-content'),mode=doc?'document':context(),combo=pointerCombo(event,[...held]);if(!combo)return;
  const latched=!doc&&selectionLatch.active&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&held.size===0?POINTER_BINDINGS.find(d=>d.id===(selectionLatch.depth||event.shiftKey?'gesture:multi-depth':'gesture:multi-plane')):undefined;
  const activation=latched&&shortcuts.get(latched);const binding=activation?.split('+').at(-1)===combo.split('+').at(-1)?{id:latched!.id,combo:latched!.defaultKey}:resolvePointerBinding(combo,mode);
  if(!binding){if(doc){apply(event,'MB1');return;}if(mode!=='world'&&mode!=='create'&&mode!=='align')return;event.preventDefault();event.stopImmediatePropagation();return;}
  if(binding.id==='gesture:origin-rotation')releaseShortcuts.consume(combo.split('+').slice(0,-1).join('+'));activeAction=binding.id;drags.set(event.pointerId,binding);apply(event,binding.combo);
 },true);
 window.addEventListener('pointerup',event=>{if(![0,1,2].includes(event.button))return;const binding=drags.get(event.pointerId);if(binding){apply(event,binding.combo);drags.delete(event.pointerId);}activeAction=undefined;},true);
 window.addEventListener('pointercancel',event=>{drags.delete(event.pointerId);activeAction=undefined;},true);
 window.addEventListener('wheel',event=>{if(capturingShortcut()||!(event.target instanceof Element)||!event.target.closest('#world'))return;const combo=pointerCombo(event,[...held],true),mode=context()==='rotate'?'world':context(),binding=combo&&(resolvePointerBinding(combo,mode)??resolvePointerBinding('Wheel',mode));if(!binding){event.preventDefault();event.stopImmediatePropagation();return;}apply(event,binding.combo);},{capture:true,passive:false});
 // Mouse-based editors (CodeMirror) receive compatibility mouse events as well.
 window.addEventListener('mousedown',event=>{if(![0,1,2].includes(event.button)||capturingShortcut()||!(event.target instanceof Element)||!event.target.closest('.cm-content'))return;const combo=pointerCombo(event,[...held]);const binding=combo&&resolvePointerBinding(combo,'document');if(binding)apply(event,binding.combo);else apply(event,'MB1');},true);
}

export const PREVIEW_BINDING:ShortcutDefinition={id:'gesture:paint-preview',category:'Omnium',label:'Toggle painting nodes in creation mode',defaultKey:'Alt',activation:true,hold:false};
const pressed=new Set<string>();
export function previewActivation(event:Pick<KeyboardEvent,'ctrlKey'|'metaKey'|'altKey'|'shiftKey'>){return [event.ctrlKey||event.metaKey?'Ctrl':'',event.altKey?'Alt':'',event.shiftKey?'Shift':'',...pressed].filter(Boolean).join('+')===shortcuts.get(PREVIEW_BINDING);}
