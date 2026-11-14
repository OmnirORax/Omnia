import {createContext,useCallback,useContext,useState,useSyncExternalStore,type SetStateAction} from 'react';
import {universalHistory} from '../core/universalHistory.ts';
import {navigationState} from './navigationState.ts';
export const UIHistoryScope=createContext('native');
export function useNavigationState<T>(name:string,initial:T|(()=>T)){
 const scope=useContext(UIHistoryScope),key=`${scope}/${name}`,[fallback]=useState(initial);
 const read=useCallback(()=>navigationState.read(key,fallback),[key,fallback]);
 const subscribe=useCallback((fn:()=>void)=>navigationState.subscribe(key,fn),[key]);
 const value=useSyncExternalStore(subscribe,read);
 const set=useCallback((next:SetStateAction<T>)=>{const before=read(),value=typeof next==='function'?(next as (before:T)=>T)(before):next;navigationState.set(key,value,!!universalHistory.currentActionId);},[key,read]);
 return [value,set]as const;
}
