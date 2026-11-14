import {useCallback,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {UIProvider,type UIContextValue,type UIFunction} from './ui/context';
import {emptyUILayout,type UILayout} from './ui/layout';
import {createTransientStore} from './ui/transientStore';
import {createRegistrationBatch} from './ui/registrationBatch';
import {ActiveContextSystem} from './ui/ActiveContext';
import {AppearanceProvider} from './appearance/Context';
import {DockWorkspace} from './ui/DockWorkspace';
import {ToolCursorLayer} from './ui/toolCursor';
import {ContextTargetController} from './ui/ContextTargetController';
import {ValueFieldBehavior} from './ui/ValueFieldBehavior';
import {defaultSettings} from './workspaceActions';
import {type Controller} from './appearance/model';
import {useCursorTracking} from './ui/cursorPosition';
const unavailable=()=>{};
/** Host the original interaction systems without the V1 UI-authoring application. */
export function ComposerRuntime({children,functions=[]}:{children:ReactNode;functions?:UIFunction[]}){
 useCursorTracking();
 const [layout,setLayout]=useState(emptyUILayout),[registered,setRegistered]=useState<Record<string,UIFunction>>({}),[controller,setController]=useState<Controller|undefined>();
 const sources=useRef(new Map<string,Map<symbol,UIFunction>>()),live=useRef(true);
 const [publish]=useState(()=>createRegistrationBatch<UIFunction>(patch=>{if(live.current)setRegistered(old=>Object.entries(patch).every(([key,value])=>old[key]===value)?old:{...old,...patch});}));
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 const registerFunction=useCallback((fn:UIFunction)=>{const token=Symbol(),entries=sources.current.get(fn.id)??new Map<symbol,UIFunction>();entries.set(token,fn);sources.current.set(fn.id,entries);publish(fn.id,fn);return()=>{entries.delete(token);publish(fn.id,[...entries.values()].at(-1)??{...fn,available:false,element:<></>});};},[publish]);
 const update=useCallback((change:(layout:UILayout)=>UILayout)=>setLayout(old=>change(old)),[]);
 const [stores]=useState<Pick<UIContextValue,'placementPreview'|'activeContext'|'defaults'|'frameActions'|'contextLayers'>>(()=>({placementPreview:createTransientStore<ReturnType<UIContextValue['placementPreview']['getSnapshot']>>(null),activeContext:createTransientStore<ReturnType<UIContextValue['activeContext']['getSnapshot']>>([]),defaults:new Map(),frameActions:new Map(),contextLayers:new Map()}));
 const defaults=useMemo(()=>defaultSettings(),[]),projection=useRef<((key:string,rect:{x:number;y:number;width:number;height:number})=>{x:number;y:number;width:number;height:number})|undefined>(undefined);
 const value=useMemo<UIContextValue>(()=>({...stores,layout,update,functions:[...functions,...Object.values(registered)],registerFunction,canMove:key=>key==='window:omnic-composer',configure:unavailable,configureFrame:unavailable,configureControl:unavailable,createFrame:unavailable,library:unavailable,frameMenu:unavailable,selectionMenu:unavailable,renderResident:()=>null,selectedFunctions:new Set(),selectingUI:false,shortcutBindings:defaults.bindings}),[layout,update,functions,registered,registerFunction,stores,defaults]);
 const appearance=useMemo(()=>({base:{...defaults.appearance,...(controller?{controller}:{})},commit:setController,preview:(_next:Controller|null)=>{},safe:false}),[defaults,controller]);
 return <UIProvider value={value}><DockWorkspace projection={projection}><AppearanceProvider bridge={appearance}><ActiveContextSystem/><ValueFieldBehavior/><ToolCursorLayer/><ContextTargetController/>{children}</AppearanceProvider></DockWorkspace></UIProvider>;
}
