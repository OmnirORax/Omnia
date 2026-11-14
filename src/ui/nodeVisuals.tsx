import {createRoot} from 'react-dom/client';
import {useRef,useState,useSyncExternalStore} from 'react';
import {ComposerRuntime} from '../composer/runtime/host.tsx';
import {PropertyTree} from '../composer/runtime/appearance/PropertyTree.tsx';
import {PropertyEditor} from '../composer/runtime/appearance/Controls.tsx';
import {NODE_BODY,NODE_VISUAL_PROPERTIES,type NodePaint} from '../properties/nodeVisuals.ts';
import {readPaint,writePaint,resetPaint} from '../core/appearance.ts';
import {locate,type Origin,type World} from '../core/model.ts';
import '../composer/runtime/host.css';

/** The actual V1 editor, bound to V2's existing global/local body properties. */
export function nodeVisualEditor(root:HTMLElement,host:{read:()=>World;subscribe:(fn:()=>void)=>()=>void;change:(edit:(world:World)=>void,group?:string)=>void;error:(message:string)=>void},target:'nodes'|'nodeDefaults',origins:readonly Origin[]){
 const react=createRoot(root),scope=`node-body:${target}:${origins.map(origin=>JSON.stringify(origin)).join(',')}`;
 function View(){
  const world=useSyncExternalStore(host.subscribe,host.read),[property,setProperty]=useState('color');
  const before=useRef(new Map<string,string|number|boolean>()),paint=readPaint(world,target,origins[0]);
  const write=(id:string,value:string|number|boolean,preview=false)=>{
   try{if(preview&&!before.current.has(id))before.current.set(id,paint[id as keyof NodePaint]!);if(!preview)before.current.delete(id);
    host.change(world=>writePaint(world,target,origins,{[id]:value}),`${scope}:${id}`);
   }catch(error){host.error(String(error));}
  };
  const cancel=(id:string)=>{const value=before.current.get(id);if(value!==undefined){before.current.delete(id);write(id,value);}};
  const available=NODE_VISUAL_PROPERTIES.map(p=>p.id),exists=target==='nodeDefaults'||origins.some(origin=>!!locate(world,origin));
  return <ComposerRuntime><PropertyTree transient scope={scope} selected={property} onSelect={setProperty} available={available} editable={exists?available:[]}
   renderEditor={id=><PropertyEditor property={id} previewTargets={[NODE_BODY]} value={paint[id as keyof NodePaint]!} disabled={!exists}
    onPreview={value=>write(id,value,true)} onCommit={value=>write(id,value)} onCancelPreview={()=>cancel(id)}/>}/>
   <button type="button" onClick={()=>host.change(world=>resetPaint(world,target,origins))}>Reset</button>
  </ComposerRuntime>;
 }
 react.render(<View/>);return()=>react.unmount();
}
