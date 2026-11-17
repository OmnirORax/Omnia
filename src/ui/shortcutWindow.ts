import {matchesAssignedShortcut,SHORTCUT_CATEGORIES,shortcuts,captureShortcut,normalizeShortcut,type ShortcutCategory,type ShortcutDefinition} from './shortcuts.ts';
/** Category-local rendering and capture; owners supply live command definitions. */
export function shortcutWindow(root:HTMLElement,read:()=>ShortcutDefinition[],ready:()=>boolean=()=>true,externalSearch?:HTMLInputElement){
 const tabs=document.createElement('nav'),search=externalSearch??document.createElement('input'),rows=document.createElement('div'),notice=document.createElement('output');
 tabs.className='shortcut-tabs';tabs.setAttribute('aria-label','Shortcut categories');search.type='search';search.placeholder='Search shortcuts';search.setAttribute('aria-label','Search shortcuts');notice.className='shortcut-notice';notice.setAttribute('role','status');
 let category:ShortcutCategory='Omnium',stopCapture:(()=>void)|undefined;
 const cancel=()=>{stopCapture?.();stopCapture=undefined;};
 function render(){
  cancel();const query=search.value.trim().toLowerCase(),catalog=read(),items=catalog.filter(item=>item.category===category&&matchesAssignedShortcut(item,shortcuts.get(item),query));
  tabs.replaceChildren(...SHORTCUT_CATEGORIES.map(name=>{const button=document.createElement('button');button.textContent=name;button.setAttribute('aria-pressed',String(category===name));button.onclick=()=>{category=name;render();};return button;}));
  rows.replaceChildren(...items.map(item=>{const row=document.createElement('div'),label=document.createElement('span'),key=document.createElement(item.editable===false?'kbd':'button');row.className='context-action';label.textContent=item.label;key.className='shortcut-key';if(key instanceof HTMLButtonElement)key.disabled=!ready();const binding=shortcuts.get(item);key.textContent=item.activation?binding||'—':item.gesture?`${item.gesture}${binding?' / '+binding:''}`:binding||'—';key.setAttribute('aria-label',item.editable===false?`${item.label}: ${item.gesture}`:`Change ${item.label} ${item.activation?'activation':'keyboard shortcut'}`);row.append(label,key);if(item.editable===false){key.classList.add('shortcut-gesture');return row;}
   key.onclick=()=>{
    cancel();rows.querySelectorAll('.shortcut-capture').forEach(element=>element.remove());stopCapture=editShortcut(row,item,read,render);
   };return row;}));
 }
 root.append(tabs,...(externalSearch?[]:[search]),notice,rows);if(!externalSearch)search.oninput=render;render();
 const unsubscribe=shortcuts.subscribe(()=>{if(root.isConnected)render();});
 return {filter(query:string){search.value=query;render();},refresh:render,dispose(){cancel();unsubscribe();}};
}

export function editShortcut(row:HTMLElement,item:ShortcutDefinition,read:()=>ShortcutDefinition[],render:()=>void){const notice=document.createElement('output');row.append(notice);
notice.textContent='';let pending:string|undefined;const editor=document.createElement('div'),value=document.createElement('kbd'),warning=document.createElement('span'),apply=document.createElement('button'),clear=document.createElement('button'),reset=document.createElement('button'),back=document.createElement('button');
    editor.className='shortcut-capture';editor.dataset.shortcutRunner='';value.textContent=item.activation?'Press combo + mouse button':'Press shortcut';apply.textContent='Apply';apply.disabled=true;clear.textContent='Clear';reset.textContent='Default';back.textContent='Cancel';
    const update=()=>{if(pending===undefined)return;value.textContent=pending||'—';try{const proposal=shortcuts.plan(item,pending,read());warning.textContent=proposal.conflicts.length?`Used by ${proposal.conflicts.map(other=>`${other.category} · ${other.label}`).join(', ')}. Swap to ${proposal.old||'unassigned'}.`:'';apply.textContent=proposal.conflicts.length?'Swap':'Apply';apply.disabled=false;}catch(error){warning.textContent=error instanceof Error?error.message:String(error);apply.disabled=true;}};
    const commit=()=>{if(pending===undefined||apply.disabled)return;try{const proposal=shortcuts.assign(item,pending,read());notice.textContent=proposal.conflicts.length?`${item.label} → ${proposal.key||'—'}; ${proposal.conflicts.map(other=>`${other.label} → ${proposal.old||'—'}`).join('; ')}`:`${item.label} → ${proposal.key||'—'}`;render();}catch(error){warning.textContent=String(error);}};
    apply.onclick=commit;clear.onclick=()=>{pending='';update();};reset.onclick=()=>{pending=item.defaultKey;update();};back.onclick=()=>{render();};
    editor.append(value,warning,apply,clear,reset,back);row.append(editor);return captureShortcut(chord=>{if(!item.activation&&item.category!=='Document')chord=normalizeShortcut(chord.replace(/Cmd/g,'Ctrl'))!;if(chord==='Enter'&&pending!==undefined){commit();return;}pending=chord;update();},()=>render(),item.activation&&!item.hold,item.hold);
}
