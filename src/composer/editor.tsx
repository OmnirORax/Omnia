import {VIEW_CLOSE} from '../ui/viewHistory.ts';
import {universalHistory} from '../core/universalHistory.ts';
import {createRoot,type Root} from 'react-dom/client';
import {useLayoutEffect,useSyncExternalStore} from 'react';
import {locate,addStructure,sameOrigin,type Origin,type World} from '../core/model.ts';
import {childNode} from '../core/nodeOperations.ts';
import {saveDefinition,definitionRecipe} from '../omnic/atlas.ts';
import {validateRecipe,type Recipe} from '../omnic/model.ts';
import {evaluateRecipe,type Evaluation} from '../omnic/evaluate.ts';
import {evaluationBounds} from '../omnic/svg.ts';
import {targetNodes} from '../omnic/contextGeometry.ts';
import {atomnicViewBounds} from '../omnic/atomnicSettings.ts';
import type {OmnicSurface} from '../omnic/surface.ts';
import {composerAtlas} from './atlasAdapter.ts';
import {ComposerRuntime} from './runtime/host.tsx';
import {OmnicComposer} from './runtime/omnic/Composer.tsx';
import {FloatingWindow} from './runtime/ui/FloatingWindow.tsx';
import type {AtomnicInteraction} from './runtime/omnic/atomnicInteraction.ts';
import type {UIFunction} from './runtime/ui/context.tsx';
import './runtime/host.css';
import {setToolCursorZone} from './runtime/ui/toolCursorZone.ts';
export type ComposerHost={historyScope?:string;restorePlacement?:boolean;surface?:(surface:OmnicSurface)=>()=>void;redraw?:()=>void;library?:()=>void;read:()=>World;change:(edit:(world:World)=>void,group?:string)=>void;select:(origin:Origin)=>void;feedback:(message:string)=>void;subscribe:(listener:()=>void)=>()=>void};
const seed=():Recipe=>({version:2,revision:0,atomnic:{active:true},components:[{id:'unit',generator:'dot',params:{size:10,color:'#ffffff',thickness:.25}}],operations:[],frames:[]});
let active:{close:()=>void}|undefined;
const journal=universalHistory;

/** Preserve the V1 UI; bridge its state owner and actual geometry into V2. */
export function composerPanel(host:ComposerHost,initial?:Origin){
 active?.close();let origin=initial,closed=false,writing=false,epoch=0,preview:Recipe|undefined,editing:AtomnicInteraction|undefined,knownDraft='',lastWorld:World|undefined,atlas:ReturnType<typeof composerAtlas>,cached:Evaluation|undefined,cachedRecipe:Recipe|undefined,cachedWorld:World|undefined,cachedBucket=-1;
 if(!origin||!locate(host.read(),origin)?.omnicDraft&&!definitionRecipe(locate(host.read(),origin)!,host.read()))host.change(world=>{world.version=3;origin??=addStructure(world,[0,0,0]).origin;locate(world,origin)!.omnicDraft=seed();});
 const root=document.createElement('div');root.className='original-composer-host';root.dataset.inputOwner='';document.body.append(root);const react:Root=createRoot(root),listeners=new Set<()=>void>();
 const readDraft=(owner=origin!)=>{const node=locate(host.read(),owner);return node&&(node.omnicDraft??definitionRecipe(node,host.read()));};
 function ownerStore(owner:Origin){return {read:()=>readDraft(owner),write:(next:Recipe)=>{
   const node=locate(host.read(),owner);if(!node)throw Error('Draft owner was removed.');const recipe=validateRecipe(next),json=JSON.stringify(recipe);if(json===JSON.stringify(node.omnicDraft??definitionRecipe(node,host.read())))return;
   knownDraft=json;writing=true;try{host.change(world=>{world.version=3;locate(world,owner)!.omnicDraft=recipe;},`composer:${JSON.stringify(owner)}`);}finally{writing=false;}
 }};}
 let draftStore=ownerStore(origin!);knownDraft=JSON.stringify(readDraft());
 const current=()=>{const world=host.read();if(world!==lastWorld){lastWorld=world;atlas=composerAtlas(world,origin!);}return atlas;};
 function geometry(){const recipe=preview??readDraft()??seed(),world=host.read(),bucket=cached?.motion?Math.floor(performance.now()/1000*12):0;if(!cached||recipe!==cachedRecipe||world!==cachedWorld||bucket!==cachedBucket){cachedRecipe=recipe;cachedWorld=world;cachedBucket=bucket;cached=evaluateRecipe(recipe,current().resolveReference,performance.now()/1000);}return {recipe,evaluation:cached};}
 function close(){if(closed)return;closed=true;root.dispatchEvent(new Event(VIEW_CLOSE));if(canvas)setToolCursorZone(canvas,undefined);releaseSurface?.();unsubscribe();react.unmount();root.remove();if(active?.close===close)active=undefined;}
 const observePreview=(next:Recipe|null,bridge?:AtomnicInteraction)=>{preview=next??undefined;editing=bridge;host.redraw?.();};
 function accept(recipe:Recipe,label?:string,variation=false){
  let nextOrigin=origin!;writing=true;
  try{host.change(world=>{let target=origin!;if(variation&&definitionRecipe(locate(world,target)!,world))target=childNode(world,target,true).origin;nextOrigin=saveDefinition(world,target,recipe,label??locate(world,target)!.label);});}finally{writing=false;}
  if(!sameOrigin(origin!,nextOrigin)){origin=nextOrigin;epoch++;draftStore=ownerStore(origin);preview=undefined;editing=undefined;}
  knownDraft=JSON.stringify(readDraft());lastWorld=undefined;revision++;host.select(origin!);notify();
 }
 const surface:OmnicSurface={get origin(){return origin;},hover:inside=>{if(canvas)setToolCursorZone(canvas,inside?editing?.cursorZone:undefined);},get bounds(){return editing?.bounds??atomnicViewBounds(geometry().recipe.atomnic)??evaluationBounds(geometry().evaluation);},get preview(){const {recipe,evaluation}=geometry();return {recipe,evaluation:{...evaluation,selection:editing?targetNodes(evaluation,editing.selected).map(node=>node.id):[]},bounds:surface.bounds,hovered:editing?.hovered,pivot:editing?.pivot,ghost:editing?.ghost,gridPitch:editing?.gridPitch};},down:(point,event)=>editing?.down(point,event),move:(point,event)=>editing?.move(point,event),up:(point,event)=>editing?.up(point,event),context:(_point,event)=>{editing?.context?.(event);
 },cancel:()=>editing?.cancel()};
 let releaseSurface=host.surface?.(surface);
 const notify=()=>{for(const listener of listeners)listener();};let revision=0;
 const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
 const canvas=document.querySelector('#world canvas');
 const unsubscribe=host.subscribe(()=>{if(closed)return;const node=locate(host.read(),origin!);if(!node){close();return;}if(writing)return;const next=JSON.stringify(readDraft());if(next!==knownDraft){knownDraft=next;epoch++;draftStore=ownerStore(origin!);preview=undefined;editing=undefined;}lastWorld=undefined;revision++;notify();});
 let mounted!:()=>void;const ready=new Promise<void>(resolve=>{mounted=resolve;});
 function View(){useLayoutEffect(mounted,[]);useSyncExternalStore(subscribe,()=>revision);const data=current(),functions:UIFunction[]=[{id:'omnic.library',label:'Omnic library',element:<button title="Omnic library" onClick={()=>host.library?.()}>☷</button>}];return <ComposerRuntime functions={functions} historyScope={host.historyScope}><FloatingWindow openAtCursor={!host.restorePlacement} dismissOnEscape={false} id="omnic-composer" title={`Omnic · ${data.entity.label||'object'}`} shape="circle" width={360} height={360} onClose={close}><OmnicComposer radar key={`${data.entity.id}:${epoch}`} workspaceId="omnium-v2" entity={data.entity} objects={data.objects} presetIds={data.presetIds} history={journal} resolveReference={data.resolveReference} referenceObject={data.referenceObject} draftStore={draftStore} initialRecipe={readDraft()} isNew={!data.entity.omnic} onPreview={observePreview} onSave={(recipe,label)=>accept(recipe,label)} onCopy={(recipe,label)=>accept(recipe,label,true)} onClose={close}/></FloatingWindow></ComposerRuntime>;}
 react.render(<View/>);host.select(origin!);active={close};root.addEventListener('pointerdown',()=>{releaseSurface?.();releaseSurface=host.surface?.(surface);});return {root,close,ready,get origin(){return origin;}};
}
