import {normalizeActivation,pointerCombo} from './activationCombo.ts';
export const SHORTCUT_CATEGORIES=['Omnium','Document','Omnic'] as const;
export type ShortcutCategory=typeof SHORTCUT_CATEGORIES[number];
export type ShortcutDefinition={category:ShortcutCategory;id:string;label:string;defaultKey:string;currentKey?:string;gesture?:string;keywords?:string;editable?:boolean;activation?:boolean;hold?:boolean;scope?:string};
export type ShortcutOverrides=Partial<Record<ShortcutCategory,Record<string,string>>>;
const macPlatform=()=>typeof navigator!=='undefined'&&/Mac|iPhone|iPad/.test(navigator.platform);
/** Accept native/CodeMirror chord notation, but never treat gesture prose as a key. */
export function normalizeShortcut(value:string,mac=macPlatform()):string|undefined{
 let text=value===' '?'Space':value.trim(),modifiers:string[]=[];
 const prefix=/^(Ctrl|Control|Cmd|Command|Meta|Mod|Alt|Shift)[+-]/i;
 for(let match; (match=prefix.exec(text));){modifiers.push(match[1]);text=text.slice(match[0].length).trim();}
 const key=text==='Escape'?'Esc':text===' '?'Space':text.length===1?text.toUpperCase():text;
 if(!key||key.length!==1&&!/^(?:F(?:[1-9]|1\d|2[0-4])|Arrow(?:Up|Down|Left|Right)|Page(?:Up|Down)|Home|End|Tab|Enter|Esc|Backspace|Delete|Insert|Space|ContextMenu)$/.test(key))return;
 const mapped=new Set(modifiers.map(m=>/^mod$/i.test(m)?mac?'Cmd':'Ctrl':/^(?:meta|cmd|command)$/i.test(m)?'Cmd':/^(?:ctrl|control)$/i.test(m)?'Ctrl':m[0].toUpperCase()+m.slice(1).toLowerCase()));
 return ['Ctrl','Cmd','Alt','Shift'].filter(m=>mapped.has(m)).concat(key).join('+');
}
export function shortcutEvent(event:Pick<KeyboardEvent,'key'|'ctrlKey'|'metaKey'|'altKey'|'shiftKey'>,category:ShortcutCategory='Document'){
 const key=event.key===' '?'Space':event.key;
 return normalizeShortcut([event.ctrlKey||category!=='Document'&&event.metaKey?'Ctrl':'',category==='Document'&&event.metaKey?'Cmd':'',event.altKey?'Alt':'',event.shiftKey&&event.key!=='+'?'Shift':'',key].filter(Boolean).join('+'));
}
export function matchesShortcut(event:KeyboardEvent,binding:string,category:ShortcutCategory='Omnium'){const expected=normalizeShortcut(binding);return expected!==undefined&&shortcutEvent(event,category)===expected;}
export const worldShortcutId=(key:string)=>`world:${normalizeShortcut(key)??key}`;
const overlaps=(a:ShortcutDefinition,b:ShortcutDefinition)=>a.scope==='application'||b.scope==='application'||(a.scope==='applicationExceptDocument'||b.scope==='applicationExceptDocument')&&a.category!=='Document'&&b.category!=='Document'||a.category===b.category&&(a.scope??'main')===(b.scope??'main');
const normalizeBinding=(value:string)=>normalizeShortcut(value)??normalizeActivation(value);
const address=(d:ShortcutDefinition)=>`${d.category}/${d.id}`;
export function createShortcutStore(){
 let state:ShortcutOverrides={},storage:Pick<Storage,'getItem'|'setItem'>|undefined;const listeners=new Set<()=>void>();
 const get=(d:ShortcutDefinition)=>state[d.category]?.[d.id]??normalizeBinding(d.currentKey??d.defaultKey)??'';
 function plan(target:ShortcutDefinition,key:string,catalog:readonly ShortcutDefinition[]){
  const normalized=key===''?'':target.activation?normalizeActivation(key):normalizeShortcut(key);if(normalized===undefined)throw Error(target.activation?'Use an activation combination.':'Use a keyboard shortcut.');if(normalized==='Ctrl+F4')throw Error('Ctrl+F4 is reserved by browser protection.');
  const unique=[...new Map(catalog.map(item=>[address(item),item])).values()],old=get(target);
  const conflicts=normalized?unique.filter(item=>address(item)!==address(target)&&get(item)===normalized&&overlaps(item,target)):[];
  // A single chord can swap across disjoint contexts, but not onto two actions
  // which would then compete in the same context.
  if(old&&conflicts.some((a,i)=>conflicts.slice(i+1).some(b=>overlaps(a,b))))throw Error(`Multiple conflicts: ${conflicts.map(item=>item.label).join(', ')}. Choose another key.`);
  if(old&&conflicts.some(item=>unique.some(other=>address(other)!==address(target)&&!conflicts.includes(other)&&get(other)===old&&overlaps(item,other))))throw Error('The old shortcut also conflicts in that context. Choose another key.');
  return {key:normalized,old,conflicts};
 }
 return {get,getSnapshot:()=>state,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},
  initialize(source:Pick<Storage,'getItem'|'setItem'>){storage=source;try{const saved=JSON.parse(source.getItem('omnium.shortcuts.1')??'{}');const next:ShortcutOverrides={};for(const category of SHORTCUT_CATEGORIES){const values=saved?.[category];if(!values||typeof values!=='object'||Array.isArray(values))continue;next[category]={};for(const [id,value]of Object.entries(values).slice(0,5000))if(id.length<=200&&typeof value==='string'&&(value===''||normalizeBinding(value)))next[category]![id]=value===''?'':normalizeBinding(value)!;}state=next;}catch{state={};}},
  restore(next:ShortcutOverrides){const checked=createShortcutStore();checked.initialize({getItem:()=>JSON.stringify(next),setItem:()=>{}});state=checked.getSnapshot();storage?.setItem('omnium.shortcuts.1',JSON.stringify(state));for(const fn of listeners)fn();},
  plan,
  assign(target:ShortcutDefinition,key:string,catalog:readonly ShortcutDefinition[]){const proposal=plan(target,key,catalog),next=structuredClone(state);next[target.category]??={};next[target.category]![target.id]=proposal.key;
   for(const conflict of proposal.conflicts){next[conflict.category]??={};next[conflict.category]![conflict.id]=proposal.old;}
   storage?.setItem('omnium.shortcuts.1',JSON.stringify(next));state=next;for(const fn of listeners)fn();return proposal;
  },
 };
}
/** Reserve the first free default once; existing user bindings always win. */
export function assignAvailableDefault(store:ReturnType<typeof createShortcutStore>,target:ShortcutDefinition,candidates:readonly string[],catalog:readonly ShortcutDefinition[]){
 if(store.getSnapshot()[target.category]?.[target.id]!==undefined)return store.get(target);
 const known=new Set(catalog.map(address)),reserved=new Set<string>();for(const [category,entries]of Object.entries(store.getSnapshot()))for(const [id,value]of Object.entries(entries??{}))if(!known.has(`${category}/${id}`))reserved.add(value);
 let binding='';for(const candidate of candidates){try{if(reserved.has(normalizeBinding(candidate)??''))continue;if(!store.plan(target,candidate,catalog).conflicts.length){binding=candidate;break;}}catch{/* Invalid conflicting assignments cannot be stolen. */}}
 if(binding!==store.get(target))store.assign(target,binding,catalog);return binding;
}
export const shortcuts=createShortcutStore();
export function shortcutBinding(category:ShortcutCategory,id:string,defaultKey:string){return shortcuts.get({category,id,defaultKey,label:id});}
export function worldBinding(key:string){return shortcutBinding('Omnium',worldShortcutId(key),key);}

export const capturingShortcut=()=>!!capture;
let capture:{key:(key:string)=>void;cancel:()=>void;pointer?:boolean;hold?:boolean}|undefined;
export function captureShortcut(key:(key:string)=>void,cancel:()=>void,pointer=false,hold=false){const session={key,cancel,pointer,hold};capture=session;return()=>{if(capture===session)capture=undefined;};}
export function installShortcutCapture(){
 const held=new Set<string>();
 window.addEventListener('pointerdown',event=>{if(!capture?.pointer||event.target instanceof Element&&event.target.closest('.shortcut-capture button'))return;event.preventDefault();event.stopImmediatePropagation();const combo=pointerCombo(event,[...held]);if(combo)capture.key(combo);},true);
 window.addEventListener('wheel',event=>{if(!capture?.pointer)return;event.preventDefault();event.stopImmediatePropagation();const combo=pointerCombo(event,[...held],true);if(combo)capture.key(combo);},{capture:true,passive:false});
 window.addEventListener('keydown',event=>{if(!capture)return;event.preventDefault();event.stopImmediatePropagation();if(event.repeat)return;if(capture.pointer&&/^[a-z0-9]$/i.test(event.key))held.add(event.key.toUpperCase());if(event.key==='Escape'){const current=capture;capture=undefined;current.cancel();return;}const key=shortcutEvent(event)??(capture.hold?normalizeActivation(event.key):undefined);if(key&&!capture.pointer)capture.key(key);},true);
 window.addEventListener('keyup',event=>{held.delete(event.key.toUpperCase());if(capture){event.preventDefault();event.stopImmediatePropagation();}},true);
 window.addEventListener('blur',()=>{held.clear();const current=capture;capture=undefined;current?.cancel();});
}

export function matchesAssignedShortcut(item:ShortcutDefinition,binding:string,query:string){if(!binding&&!item.gesture)return false;const words=(text:string)=>text.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();const haystack=words([item.label,binding,item.gesture??'',item.keywords??''].join(' '));return words(query).split(/\s+/).every(word=>haystack.includes(word));}
