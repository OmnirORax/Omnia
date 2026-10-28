export type RadialGroup={id:string;label:string;symbol:string;hidden?:boolean};
export type RadialEntry<T>={id:string;label:string;symbol:string;group?:readonly RadialGroup[];content:T};
export type RadialNode<T>=RadialGroup & {children?:RadialNode<T>[];content?:T};
/** Shared presentation grouping; commands/values remain with their existing owner. */
export function radialTree<T>(entries:readonly RadialEntry<T>[]):RadialNode<T>[] {
  const roots:RadialNode<T>[]=[];
  for(const entry of entries){
    if(entry.group?.some(group=>group.hidden))continue;
    let level=roots;
    for(const group of entry.group??[]){
      let node=level.find(node=>node.id===group.id&&node.children);
      if(!node){node={...group,children:[]};level.push(node);}
      level=node.children!;
    }
    level.push({id:entry.id,label:entry.label,symbol:entry.symbol,content:entry.content});
  }
  // Bound crowding as applicable controls grow; overflow stays reachable.
  const compact=(nodes:RadialNode<T>[]):RadialNode<T>[]=>{
    const mapped=nodes.map(node=>node.children?{...node,children:compact(node.children)}:node);
    return mapped.length<=6?mapped:[...mapped.slice(0,5),{id:`more:${mapped[5].id}`,label:'More tools',symbol:'⋯',children:compact(mapped.slice(5))}];
  };
  return compact(roots);
}
/** Only the current category expands. Deeper levels stop shrinking at a usable
 * 24px target; the full path remains available to Back. */
export function radialDimensions(depth:number,count=6) {
  const base=depth===0?{extent:160,radius:64,size:32}:depth===1?{extent:100,radius:34,size:28}:{extent:88,radius:30,size:24};
  const radius=Math.max(base.radius,count>1?Math.ceil((base.size+2)/(2*Math.sin(Math.PI/count))):0);
  return {...base,radius,extent:Math.max(base.extent,2*(radius+base.size/2))};
}
/** Top then clockwise, independent of the active ring's footprint. */
export function radialSlot(index:number,count:number,depth:number) {
  const {radius,extent,size}=radialDimensions(depth,count),turn=index/count*Math.PI*2;
  return {x:50+Math.sin(turn)*radius/extent*100,y:50-Math.cos(turn)*radius/extent*100,size};
}
