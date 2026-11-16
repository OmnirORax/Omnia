import {useEffect,useRef} from 'react';
import {registerContextActions,refreshContextActions} from '../../../ui/contextActions';
import {FEATURE_ACTIONS,featureActionRuntime} from '../featureActions';
import {shortcutBinding} from '../workspaceActions';
import {useUI} from './context';
import {contextTargets} from './contextTargets';
export function ContextActionsBridge(){
 const ui=useUI(),latest=useRef(ui);latest.current=ui;
 useEffect(()=>registerContextActions({label:'Omnic',owns:element=>!!element.closest('.omnic-composer,.omnic-composer-radar,.floating-window,[data-context-controller]'),read:()=>[...FEATURE_ACTIONS.filter(action=>featureActionRuntime.available(action.id)).map(action=>({label:action.label,key:shortcutBinding(action.id,latest.current.shortcutBindings??{}),run:()=>{featureActionRuntime.invoke(action.id);}})),...latest.current.functions.filter(fn=>fn.available!==false&&!FEATURE_ACTIONS.some(action=>action.id===fn.id)).map(fn=>({label:fn.label,key:latest.current.shortcutBindings?.[fn.id]}))]}),[]);
 useEffect(()=>contextTargets.subscribe(refreshContextActions),[]);
 useEffect(()=>{refreshContextActions();},[ui.functions,ui.activeContext.getSnapshot()]);
 return null;
}
