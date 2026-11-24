import {panel} from '../ui/panel.ts';
import {cloud} from './cloud.ts';
import {accountWorkspaces} from './workspaceContext.ts';
import {workspacePicker} from './workspacePicker.ts';
let active:{show:()=>void}|undefined;
export async function openAccountPanel(){
 if(active){active.show();return;}
 const context=accountWorkspaces(),client=context.client;let closed=false,busy=false,stopPicker=()=>{};
 const view=panel('Account / Cloud',()=>{closed=true;stop();stopPicker();active=undefined;});active=view;
 const body=document.createElement('div'),status=document.createElement('output');status.setAttribute('role','status');view.body.append(body,status);
 function field(parent:HTMLElement,label:string,type='text'){const row=document.createElement('label'),input=document.createElement('input');row.append(document.createTextNode(label),input);input.type=type;parent.append(row);return input;}
 async function run(action:()=>Promise<void>){if(busy)return;busy=true;const valid=context.current();status.textContent='';try{await action();}catch(error){if(!closed&&valid())status.textContent=error instanceof Error?error.message:String(error);}finally{busy=false;}}
 function button(label:string,action:()=>Promise<void>){const b=document.createElement('button');b.textContent=label;b.onclick=()=>void run(action);body.append(b);return b;}
 function render(){
  if(closed)return;stopPicker();body.replaceChildren();const {session}=context.state;
  if(!session){const form=document.createElement('form');body.append(form);const email=field(form,'Email','email'),password=field(form,'Password','password');email.autocomplete='username';password.autocomplete='current-password';email.required=password.required=true;const submit=document.createElement('button');submit.type='submit';submit.textContent='Sign in';form.append(submit);form.onsubmit=event=>{event.preventDefault();void run(async()=>{try{const {error}=await client.auth.signInWithPassword({email:email.value.trim(),password:password.value});if(error)throw Error('Sign-in failed. Check the account and password.');}finally{password.value='';}});};return;}
  const identity=document.createElement('div');identity.textContent=session.user.email??'Signed in';body.append(identity);
  button('Copy account ID',()=>navigator.clipboard.writeText(session.user.id));button('Sign out',async()=>{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;});
  const picker=workspacePicker(body,()=>{});stopPicker=picker.dispose;
  if(context.state.role==='owner'){
   const member=field(body,'Member account ID'),permission=document.createElement('select');for(const value of ['viewer','editor','remove']){const option=document.createElement('option');option.value=value;option.textContent=value;permission.append(option);}body.append(permission);
   button('Set member access',async()=>{await cloud.setMember(client,context.state.id,member.value.trim(),permission.value==='remove'?null:permission.value as 'viewer'|'editor');await context.refresh();});
  }
 }
 const stop=context.subscribe(()=>{status.textContent='';render();});render();await context.ready;
}
