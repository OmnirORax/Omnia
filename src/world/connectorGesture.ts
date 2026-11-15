export function startsConnector(event:{button:number;shiftKey:boolean;ctrlKey?:boolean;metaKey?:boolean;altKey?:boolean},node:boolean,picking:boolean){
 return node&&!picking&&event.shiftKey&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&(event.button===0||event.button===2);
}
export function connectorDragged(start:{x:number;y:number},end:{x:number;y:number}){return Math.hypot(end.x-start.x,end.y-start.y)>=4;}
