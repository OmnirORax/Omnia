import {accountWorkspaces,type WorkspaceContext} from './workspaceContext.ts';
/** The same destination/permission selector in every workspace consumer. */
export function workspacePicker(parent:HTMLElement,onChange:(context:WorkspaceContext)=>void,options:{create?:boolean;account?:()=>void;error?:(error:unknown)=>void}={}){
 let live=true;const context=accountWorkspaces(),root=document.createElement('div'),select=document.createElement('select'),status=document.createElement('output');select.setAttribute('aria-label','Account workspace');root.append(select,status);parent.append(root);
 const refresh=document.createElement('button');refresh.textContent='Refresh';refresh.onclick=()=>void context.refresh();root.append(refresh);
 if(options.account){const account=document.createElement('button');account.textContent='Account';account.onclick=options.account;root.append(account);}
 if(options.create){const name=document.createElement('input'),create=document.createElement('button');name.placeholder='Workspace name';name.maxLength=100;name.setAttribute('aria-label','New account workspace');create.textContent='Create';let pending:{name:string;id:string;actor:string}|undefined;create.onclick=()=>{const value=name.value.trim();if(!value)return;const actor=context.state.session?.user.id;if(!actor)return;if(pending?.name!==value||pending.actor!==actor)pending={name:value,id:crypto.randomUUID(),actor};create.disabled=true;void context.create(value,pending.id).then(()=>{pending=undefined;name.value='';}).catch(error=>options.error?.(error)).finally(()=>{create.disabled=false;});};root.append(name,create);}
 select.onchange=()=>{try{context.select(select.value);}catch(error){options.error?.(error);}};
 function render(){if(!live)return;const state=context.state;select.replaceChildren();for(const item of state.workspaces){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.append(option);}select.value=state.id;status.textContent=state.error||(!state.session?'Sign in through Account':state.role??'');onChange(context);}
 const stop=context.subscribe(render);render();void context.ready;
 return {context,root,dispose(){live=false;stop();}};
}
