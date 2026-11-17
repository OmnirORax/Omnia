/** Shared native-color lifecycle: transient input, one accepted edit, reversible cancellation. */
export function createColorSession(options:{value:string;preview:(value:string)=>void;commit:(value:string)=>void;cancel:()=>void}){
 let baseline=options.value,current=baseline,editing=false;
 return {get editing(){return editing;},get value(){return current;},
  sync(value:string){if(!editing)baseline=current=value;},
  input(value:string){if(current===value)return;current=value;editing=true;options.preview(value);},
  accept(value=current){const changed=value!==baseline;current=value;editing=false;baseline=value;if(changed)options.commit(value);else options.cancel();},
  cancel(){if(!editing)return;current=baseline;editing=false;options.cancel();}
 };
}
export function bindColorSession(input:HTMLInputElement,options:{read?:()=>string;preview:(value:string)=>void;commit:(value:string)=>void;cancel:()=>void}){
 const session=createColorSession({value:input.value,...options});
 input.addEventListener('input',event=>{event.stopPropagation();if(!session.editing&&options.read)session.sync(options.read());session.input(input.value);});
 input.addEventListener('change',event=>{event.stopPropagation();session.accept(input.value);input.defaultValue=input.value;});
 input.addEventListener('blur',()=>{if(session.editing)session.accept(input.value);});
 input.addEventListener('keydown',event=>{if(event.key==='Escape'){session.cancel();input.value=session.value;}});
 return session;
}
