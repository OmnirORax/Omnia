import {editShortcut} from './shortcutWindow.ts';
import {worldBinding,matchesShortcut,normalizeShortcut,shortcuts,worldShortcutId,type ShortcutDefinition} from './shortcuts.ts';
export type ContextAction={label:string;id?:string;scope?:string;key?:string;defaultKey?:string;run?:()=>void};
type Source={label:string;owns:(element:Element)=>boolean;read:()=>readonly ContextAction[]};
const sources=new Map<symbol,Source>();let active:symbol|undefined,root:HTMLElement|undefined,visible=false,frame=0;let panel:Element|null=null,stopCapture:(()=>void)|undefined;
const controlDefinitions=new Map<string,ShortcutDefinition>();
let controlCatalog:()=>ShortcutDefinition[]=()=>[];
export function controlShortcutDefinitions(){return [...controlDefinitions.values()];}
export function registerControlShortcutCatalog(read:()=>ShortcutDefinition[]){controlCatalog=read;}
function definition(action:ContextAction,context:string):ShortcutDefinition{const canonical=context==='Omnium';return {category:context==='Document'?'Document':context==='Omnic'?'Omnic':'Omnium',id:action.id??(canonical?worldShortcutId(normalizeShortcut(action.key??'')??action.label):`control:${context}:${action.label}`),label:action.label,scope:action.scope,defaultKey:action.defaultKey??normalizeShortcut(action.key??'')??''};}

export function refreshContextActions(){if(!visible||frame||stopCapture)return;frame=requestAnimationFrame(()=>{frame=0;if(!stopCapture)render();});}
function render(){
 if(!root)return;stopCapture?.();stopCapture=undefined;const source:Pick<Source,'label'|'read'>|undefined=panel?.isConnected?{label:panel.querySelector('header strong,header,h2,h3')?.textContent?.trim()??'Actions',read:()=>[...panel!.querySelectorAll<HTMLButtonElement>('button')].filter(button=>!button.disabled&&button.getClientRects().length).map(button=>({label:button.getAttribute('aria-label')??button.textContent?.trim()??'',run:()=>button.click()})).filter(action=>action.label)}:active&&sources.get(active)||[...sources.values()][0];if(!source){root.replaceChildren();return;}
 const heading=document.createElement('strong');heading.textContent=source.label;
 const rows=source.read().map(action=>{const row=document.createElement('div');row.className='context-action';const label=document.createElement('span');label.textContent=action.label;const key=document.createElement('kbd');key.textContent=source.label==='Omnium'&&action.key&&!action.defaultKey?(normalizeShortcut(action.key)?worldBinding(action.key):action.key.replace(/\b(?:W|N|O|Esc)\b/g,key=>worldBinding(key))):action.key??'';row.append(label,key);if(action.run){label.onclick=()=>{action.run?.();refreshContextActions();};const item=definition(action,source.label);controlDefinitions.set(`${item.category}/${item.id}`,item);key.textContent=shortcuts.get(item)||(!normalizeShortcut(action.key??'')?action.key:'')||'—';key.tabIndex=0;key.setAttribute('role','button');key.setAttribute('aria-label',`Change ${action.label} shortcut`);key.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();key.click();}};key.onclick=event=>{event.stopPropagation();stopCapture?.();root!.querySelectorAll('.shortcut-capture').forEach(el=>el.remove());stopCapture=editShortcut(row,item,()=>[...new Map([...controlCatalog(),...controlDefinitions.values()].map(d=>[`${d.category}/${d.id}`,d])).values()],render);};}return row;});
 root.replaceChildren(heading,...rows);
}
export function registerContextActions(source:Source){const id=Symbol(source.label);sources.set(id,source);refreshContextActions();return()=>{assignedShortcuts();sources.delete(id);if(active===id)active=undefined;refreshContextActions();};}
export function installContextActions(){
 root=document.createElement('aside');root.className='context-actions';root.dataset.contextController='';root.setAttribute('aria-label','Active context actions');root.hidden=true;document.body.append(root);
 root.addEventListener('pointerdown',event=>event.preventDefault());
 const activate=(event:Event)=>{if(!(event.target instanceof Element)||root?.contains(event.target))return;const found=[...sources].reverse().find(([,source])=>source.owns(event.target as Element))?.[0];const nextPanel=found?null:event.target.closest('.panel,#tools');if(found!==active||nextPanel!==panel){active=found;panel=nextPanel;refreshContextActions();}};
 for(const type of ['pointerover','focusin'])document.addEventListener(type,activate);
 for(const type of ['pointerup','keyup'])document.addEventListener(type,refreshContextActions);
 window.addEventListener('keydown',event=>{if(event.defaultPrevented||event.repeat||event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable],.shortcut-capture'))return;const source=active&&sources.get(active);if(source){for(const action of source.read()){if(!action.run)continue;const item=definition(action,source.label);if((item.id.startsWith('control:')||source.label==='Omnium'&&!controlCatalog().some(d=>d.id===item.id))&&matchesShortcut(event,shortcuts.get(item),item.category)){event.preventDefault();action.run();return;}}}else if(panel?.isConnected){for(const button of panel.querySelectorAll<HTMLButtonElement>('button')){const label=button.getAttribute('aria-label')??button.textContent?.trim()??'',context=panel.querySelector('header strong,header,h2,h3')?.textContent?.trim()??'Actions',item=definition({label},context);if(!button.disabled&&matchesShortcut(event,shortcuts.get(item),item.category)){event.preventDefault();button.click();return;}}}},true);
 window.addEventListener('keydown',event=>{
  if(event.defaultPrevented||!matchesShortcut(event,worldBinding('.'))||event.repeat||event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))return;
  stopCapture?.();stopCapture=undefined;event.preventDefault();event.stopImmediatePropagation();visible=!visible;root!.hidden=!visible;if(visible)render();
 },true);
}

const shortcutArchive=new Map<string,{label:string;key:string}[]>();
export function assignedShortcuts(){for(const source of sources.values())shortcutArchive.set(source.label,source.read().map(action=>({label:action.label,key:action.run?shortcuts.get(definition(action,source.label)):action.key??''})).filter(action=>action.key));return [...[...controlDefinitions.values()].filter(d=>shortcuts.get(d)).map(d=>({context:d.category,label:d.label,key:shortcuts.get(d)})),...[...shortcutArchive].flatMap(([context,actions])=>actions.map(action=>({context,...action})))];}

export function shortcutContextFor(element:Element){return [...sources.values()].reverse().find(source=>source.owns(element))?.label;}
