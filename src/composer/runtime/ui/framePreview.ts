/** Keep pointer sampling cheap; only the newest value reaches each paint. */
export function createFramePreview<T>(apply:(value:T)=>void,schedule:(run:()=>void)=>number=requestAnimationFrame,cancel:(id:number)=>void=cancelAnimationFrame){
 let frame:number|undefined,pending:{value:T}|undefined;
 const discard=()=>{if(frame!==undefined)cancel(frame);frame=undefined;pending=undefined;};
 const flush=()=>{const next=pending;discard();if(next)apply(next.value);};
 return {push(value:T){pending={value};if(frame===undefined)frame=schedule(flush);},flush,discard};
}
