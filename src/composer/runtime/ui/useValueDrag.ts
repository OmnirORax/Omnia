import {useLayoutEffect,useRef,useState} from 'react';
import {registerValueDrag,type NumberDrag} from '../../../ui/valueDrag.ts';
export function useValueDrag(config:NumberDrag&{disabled?:boolean},preview:(value:number)=>void,commit:(value:number)=>void,cancel?:(value:number)=>void){
 const [root,setRoot]=useState<HTMLButtonElement|null>(null),latest=useRef({config,preview,commit,cancel});latest.current={config,preview,commit,cancel};
 useLayoutEffect(()=>{const node=root;if(!node)return;return registerValueDrag(node,{
  read:()=>latest.current.config.disabled?undefined:latest.current.config,
  input:value=>latest.current.preview(value),commit:value=>latest.current.commit(value),
  cancel:value=>(latest.current.cancel??latest.current.preview)(value),
 });},[root]);
 return setRoot;
}
