/** Composer-owned stroke sampling; consumers supply coordinates and placement rules.
 * Bounded per input packet, independent of renderer, persistence and pointer ownership. */
export function paintSamples<T extends {x:number;y:number;z?:number}>(from:T,to:T,step:number):T[]{
 const count=Math.min(64,Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y,(to.z??0)-(from.z??0))/Math.max(.25,step/2))));
 return Array.from({length:count},(_,index)=>{const t=(index+1)/count;return {...to,x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,...(to.z===undefined?{}:{z:(from.z??0)+((to.z??0)-(from.z??0))*t})};});
}
