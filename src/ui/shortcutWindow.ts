import {SHORTCUT_CATEGORIES,shortcuts,captureShortcut,normalizeShortcut,type ShortcutCategory,type ShortcutDefinition} from './shortcuts.ts';
/** Category-local rendering and capture; owners supply live command definitions. */
export function shortcutWindow(root:HTMLElement,read:()=>ShortcutDefinition[],ready:()=>boolean=()=>true){
 const tabs=document.createElement('nav'),search=document.createElement('input'),rows=document.createElement('div'),notice=document.createElement('output');
 tabs.className='shortcut-tabs';tabs.setAttribute('aria-label','Shortcut categories');search.type='search';search.placeholder='Search shortcuts';search.setAttribute('aria-label','Search shortcuts');notice.className='shortcut-notice';notice.setAttribute('role','status');
 let category:ShortcutCategory='Omnium',stopCapture:(()=>void)|undefined;
 const cancel=()=>{stopCapture?.();stopCapture=undefined;};
 function render(){
  cancel();const query=search.value.trim().toLowerCase(),catalog=read(),items=catalog.filter(item=>item.category===category&&`${item.label} ${shortcuts.get(item)}`.toLowerCase().includes(query));
  tabs.replaceChildren(...SHORTCUT_CATEGORIES.map(name=>{const button=document.createElement('button');button.textContent=name;button.setAttribute('aria-pressed',String(category===name));button.onclick=()=>{category=name;render();};return button;}));
  rows.replaceChildren(...items.map(item=>{const row=document.createElement('div'),label=document.createElement('span'),key=document.createElement('button');row.className='context-action';label.textContent=item.label;key.className='shortcut-key';key.disabled=!ready();const binding=shortcuts.get(item);key.textContent=item.gesture?`${item.gesture}${binding?' / '+binding:''}`:binding||'—';key.setAttribute('aria-label',`Change ${item.label} keyboard shortcut`);row.append(label,key);
   key.onclick=()=>{
    cancel();rows.querySelectorAll('.shortcut-capture').forEach(element=>element.remove());notice.textContent='';let pending:string|undefined;const editor=document.createElement('div'),value=document.createElement('kbd'),warning=document.createElement('span'),apply=document.createElement('button'),clear=document.createElement('button'),reset=document.createElement('button'),back=document.createElement('button');
    editor.className='shortcut-capture';editor.dataset.shortcutRunner='';value.textContent='Press shortcut';apply.textContent='Apply';apply.disabled=true;clear.textContent='Clear';reset.textContent='Default';back.textContent='Cancel';
    const update=()=>{if(pending===undefined)return;value.textContent=pending||'—';try{const proposal=shortcuts.plan(item,pending,read());warning.textContent=proposal.conflicts.length?`Used by ${proposal.conflicts.map(other=>`${other.category} · ${other.label}`).join(', ')}. Swap to ${proposal.old||'unassigned'}.`:'';apply.textContent=proposal.conflicts.length?'Swap':'Apply';apply.disabled=false;}catch(error){warning.textContent=error instanceof Error?error.message:String(error);apply.disabled=true;}};
    const commit=()=>{if(pending===undefined||apply.disabled)return;try{const proposal=shortcuts.assign(item,pending,read());notice.textContent=proposal.conflicts.length?`${item.label} → ${proposal.key||'—'}; ${proposal.conflicts.map(other=>`${other.label} → ${proposal.old||'—'}`).join('; ')}`:`${item.label} → ${proposal.key||'—'}`;render();}catch(error){warning.textContent=String(error);}};
    apply.onclick=commit;clear.onclick=()=>{pending='';update();};reset.onclick=()=>{pending=item.defaultKey;update();};back.onclick=()=>{render();key.focus();};
    editor.append(value,warning,apply,clear,reset,back);row.append(editor);stopCapture=captureShortcut(chord=>{if(item.category!=='Document')chord=normalizeShortcut(chord.replace(/Cmd/g,'Ctrl'))!;if(chord==='Enter'&&pending!==undefined){commit();return;}pending=chord;update();},()=>render());
   };return row;}));
 }
 root.append(tabs,search,notice,rows);search.oninput=render;render();search.focus();
 const unsubscribe=shortcuts.subscribe(()=>{if(root.isConnected)render();});
 return {refresh:render,dispose(){cancel();unsubscribe();}};
}
