/** Provisional base-anchored slot grammar, independent of any visual target. */
export type MathematicalSlotMode='normal'|'recursion';
export function mathematicalSlotValue(base:number,ordinal:number,mode:MathematicalSlotMode){
 return mode==='recursion'?base**(ordinal+1):base*ordinal;
}
/** Maximum equally sized non-overlapping circles on a ring of centre radius r. */
export function radialSlotCapacity(radius:number,diameter:number){
 if(radius<=0||diameter<=0||diameter>2*radius)return 1;
 return Math.max(1,Math.floor(Math.PI/Math.asin(diameter/(2*radius))+1e-9));
}

/** Only a mark beyond the current outer rim unlocks the next order. */
export function canAddMathematicalRing(orders:number,markedOrders:readonly number[],limit=4){
 return orders<limit&&markedOrders.includes(orders);
}

export type MathematicalStrokeSlot={key:string;x:number;y:number;radius:number};
/** Segment hits prevent fast pointer moves skipping slots. Preserves identity if unchanged. */
export function fillMathematicalSlots(selected:readonly string[],slots:readonly MathematicalStrokeSlot[],from:{x:number;y:number},to:{x:number;y:number}):readonly string[]{
 const found=new Set(selected),dx=to.x-from.x,dy=to.y-from.y,length=dx*dx+dy*dy;
 for(const slot of slots){const t=length?Math.max(0,Math.min(1,((slot.x-from.x)*dx+(slot.y-from.y)*dy)/length)):0;
 if((slot.x-from.x-t*dx)**2+(slot.y-from.y-t*dy)**2<=slot.radius**2)found.add(slot.key);}
 return found.size===selected.length?selected:[...found];
}
