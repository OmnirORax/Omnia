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

export type MathematicalActivation={key:string;ordinal:number;mode:MathematicalSlotMode};
/** The canonical sum used by every dial interaction; duplicate marks count once. */
export function mathematicalSelectionValue(base:number,activations:readonly MathematicalActivation[]){
 const seen=new Set<string>();let value=0;
 for(const activation of activations){
  if(seen.has(activation.key))continue;seen.add(activation.key);
  if(base===1&&activation.mode==='recursion')return NaN;
  value+=mathematicalSlotValue(base,activation.ordinal,activation.mode);
 }
 return value;
}

export type MathematicalDomain={min:number;max:number;integer?:boolean};
export type MathematicalEditingRule={kind:'value'}|{kind:'increment';amount:number};
export type MathematicalEditContext={anchor:number;index:number;rule:MathematicalEditingRule};
/** Numeral selection and the rule governing an edit are independent. Re-evaluate
 * from a frozen starting value, never from the preceding hover/paint sample. */
export function mathematicalEditValue({anchor,index,rule}:MathematicalEditContext){
 if(!Number.isSafeInteger(index)||!Number.isFinite(anchor))return NaN;
 if(rule.kind==='value')return index;
 if(!Number.isFinite(rule.amount)||rule.amount<=0)return NaN;
 return index===0?anchor:Number((anchor+index*rule.amount).toPrecision(15));
}
/** Signed raw numerals. Decimal notation/equations remain a later extension. */
export function mathematicalNumberValue(base:number,activations:readonly MathematicalActivation[],sign:1|-1=1){
 const magnitude=mathematicalSelectionValue(base,activations);
 return magnitude===0?0:sign*magnitude;
}
export function mathematicalValueAllowed(value:number,domain:MathematicalDomain){
 return Number.isFinite(value)&&Math.abs(value)<=Number.MAX_SAFE_INTEGER&&value>=domain.min&&value<=domain.max&&(!domain.integer||Number.isSafeInteger(value));
}
/** Gesture bookkeeping only; the property owner remains authoritative. Incoming
 * Undo/Redo or another editor invalidates the old scratch numeral/preview. */
export function mathematicalValueSession(value:number){
 let committed=value,expected=value,sampling=false;
 return {
  receive(next:number){if(next===expected)return false;committed=expected=next;sampling=false;return true;},
  preview(next:number){expected=next;sampling=true;return next;},
  commit(next:number){committed=expected=next;sampling=false;return next;},
  restore(){expected=committed;sampling=false;return committed;},
  get sampling(){return sampling;},
 };
}

export type MathematicalMarks={selected:readonly string[];modes:Readonly<Record<string,MathematicalSlotMode>>};
/** Painting stamps the cursor mode only into visited slots, retaining all other marks. */
export function paintMathematicalSlots(before:MathematicalMarks,visited:readonly string[],brush:MathematicalSlotMode):MathematicalMarks{
 const selected=new Set(before.selected),modes={...before.modes};let changed=false;
 for(const key of visited){if(!selected.has(key)){selected.add(key);changed=true;}if((modes[key]??'normal')!==brush){modes[key]=brush;changed=true;}}
 return changed?{selected:[...selected],modes}:before;
}
