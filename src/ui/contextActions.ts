import {worldBinding,matchesShortcut,normalizeShortcut} from './shortcuts.ts';
export type ContextAction={label:string;key?:string;defaultKey?:string;run?:()=>void};
type Source={label:string;owns:(element:Element)=>boolean;read:()=>readonly ContextAction[]};
const sources=new Map<symbol,Source>();let active:symbol|undefined,root:HTMLElement|undefined,visible=false,frame=0;let panel:Element|null=null;
export function refreshContextActions(){if(!visible||frame)return;frame=requestAnimationFrame(()=>{frame=0;render();});}
function render(){
 if(!root)return;const source:Pick<Source,'label'|'read'>|undefined=panel?.isConnected?{label:panel.querySelector('header strong,header,h2,h3')?.textContent?.trim()??'Actions',read:()=>[...panel!.querySelectorAll<HTMLButtonElement>('button')].filter(button=>!button.disabled&&button.getClientRects().length).map(button=>({label:button.getAttribute('aria-label')??button.textContent?.trim()??'',run:()=>button.click()})).filter(action=>action.label)}:active&&sources.get(active)||[...sources.values()][0];if(!source){root.replaceChildren();return;}
 const heading=document.createElement('strong');heading.textContent=source.label;
 const rows=source.read().map(action=>{const row=document.createElement(action.run?'button':'div');row.className='context-action';const label=document.createElement('span');label.textContent=action.label;const key=document.createElement('kbd');key.textContent=source.label==='Omnium'&&action.key&&!action.defaultKey?(normalizeShortcut(action.key)?worldBinding(action.key):action.key.replace(/\b(?:W|N|O|Esc)\b/g,key=>worldBinding(key))):action.key??'';row.append(label,key);if(action.run)row.onclick=()=>{action.run?.();refreshContextActions();};return row;});
 root.replaceChildren(heading,...rows);
}
export function registerContextActions(source:Source){const id=Symbol(source.label);sources.set(id,source);refreshContextActions();return()=>{assignedShortcuts();sources.delete(id);if(active===id)active=undefined;refreshContextActions();};}
export function installContextActions(){
 root=document.createElement('aside');root.className='context-actions';root.dataset.contextController='';root.setAttribute('aria-label','Active context actions');root.hidden=true;document.body.append(root);
 root.addEventListener('pointerdown',event=>event.preventDefault());
 const activate=(event:Event)=>{if(!(event.target instanceof Element)||root?.contains(event.target))return;const found=[...sources].reverse().find(([,source])=>source.owns(event.target as Element))?.[0];const nextPanel=found?null:event.target.closest('.panel,#tools');if(found!==active||nextPanel!==panel){active=found;panel=nextPanel;refreshContextActions();}};
 for(const type of ['pointerover','focusin'])document.addEventListener(type,activate);
 for(const type of ['pointerup','keyup'])document.addEventListener(type,refreshContextActions);
 window.addEventListener('keydown',event=>{
  if(event.defaultPrevented||!matchesShortcut(event,worldBinding('.'))||event.repeat||event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))return;
  event.preventDefault();event.stopImmediatePropagation();visible=!visible;root!.hidden=!visible;if(visible)render();
 },true);
}

const shortcutArchive=new Map<string,{label:string;key:string}[]>();
export function assignedShortcuts(){for(const source of sources.values())shortcutArchive.set(source.label,source.read().filter(action=>action.key).map(action=>({label:action.label,key:action.key!})));return [...shortcutArchive].flatMap(([context,actions])=>actions.map(action=>({context,...action})));}
