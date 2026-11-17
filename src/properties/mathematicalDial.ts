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
export type MathematicalEditingRule={kind:'value'}|{kind:'increment';amount:number}|{kind:'match';reference:number;measurement:number;response:number};
export type MathematicalEditContext={anchor:number;index:number;rule:MathematicalEditingRule};
/** Numeral selection and the rule governing an edit are independent. Re-evaluate
 * from a frozen starting value, never from the preceding hover/paint sample. */
export function mathematicalEditValue({anchor,index,rule}:MathematicalEditContext){
 if(!Number.isSafeInteger(index)||!Number.isFinite(anchor))return NaN;
 if(rule.kind==='value')return index;
 if(rule.kind==='match')return Number.isFinite(rule.reference)&&Number.isFinite(rule.measurement)&&Number.isFinite(rule.response)&&rule.response!==0?anchor+(rule.reference-rule.measurement)/rule.response:NaN;
 if(!Number.isFinite(rule.amount)||rule.amount<=0)return NaN;
 return index===0?anchor:Number((anchor+index*rule.amount).toPrecision(15));
}
/** Signed raw numerals. Decimal notation/equations remain a later extension. */
export function mathematicalNumberValue(base:number,activations:readonly MathematicalActivation[],sign:1|-1=1){
 const magnitude=mathematicalSelectionValue(base,activations);
 return magnitude===0?0:sign*magnitude;
}
/** Empty raw numerals resolve to the nearest legal neutral value. */
export function mathematicalEmptyValue(value:number,domain:MathematicalDomain){
 const low=domain.integer?Math.ceil(domain.min):domain.min,high=domain.integer?Math.floor(domain.max):domain.max;
 return Math.max(low,Math.min(high,value));
}
export function mathematicalValueAllowed(value:number,domain:MathematicalDomain){
 return Number.isFinite(value)&&Math.abs(value)<=Number.MAX_SAFE_INTEGER&&value>=domain.min&&value<=domain.max&&(!domain.integer||Number.isSafeInteger(value));
}
/** Gesture bookkeeping only; the property owner remains authoritative. Incoming
 * Undo/Redo or another editor invalidates the old scratch numeral/preview. */
export function mathematicalValueSession<T>(value:T,equal:(a:T,b:T)=>boolean=(a,b)=>a===b){
 let committed=value,expected=value,received=value,sampling=false;
 return {
  receive(next:T){if(equal(next,received))return false;received=next;if(equal(next,expected))return false;committed=expected=next;sampling=false;return true;},
  preview(next:T){expected=next;sampling=true;return next;},
  commit(next:T){committed=expected=received=next;sampling=false;return next;},
  restore(){expected=committed;sampling=false;return committed;},
  get committed(){return committed;},
  get sampling(){return sampling;},
  get expected(){return expected;},
 };
}

export type MathematicalMarks={selected:readonly string[];modes:Readonly<Record<string,MathematicalSlotMode>>};
/** Painting stamps the cursor mode only into visited slots, retaining all other marks. */
export function paintMathematicalSlots(before:MathematicalMarks,visited:readonly string[],brush:MathematicalSlotMode,erase=false):MathematicalMarks{
 const selected=new Set(before.selected),modes={...before.modes};let changed=false;
 for(const key of visited){if(erase){if(selected.delete(key))changed=true;delete modes[key];continue;}if(!selected.has(key)){selected.add(key);changed=true;}if((modes[key]??'normal')!==brush){modes[key]=brush;changed=true;}}
 return changed?{selected:[...selected],modes}:before;
}

/** Horizontal traversal of an already prepared dial's legal slots. */
export function mathematicalSlotScrub(keys:readonly string[],originX:number,initialIndex:number,pixelsPerSlot=24){
 const start=Math.max(0,Math.min(keys.length-1,initialIndex));
 return (x:number)=>!keys.length||!Number.isFinite(x)||Math.abs(x-originX)<3?undefined:keys[Math.max(0,Math.min(keys.length-1,start+Math.round((x-originX)/pixelsPerSlot)))];
}

export type MathematicalScaleMode='value'|'halving'|'doubling'|'division';
/** Each exponent is applied to the frozen input, never to the previous sample. */
export function mathematicalScaleValue(anchor:number,count:number,mode:Exclude<MathematicalScaleMode,'value'>){
 if(!Number.isFinite(anchor)||!Number.isSafeInteger(count)||count<0)return NaN;
 if(mode==='division')return count>0?anchor/count:NaN;
 if(count>2048)return NaN;
 let value=anchor;for(let i=0;i<count;i++)value*=mode==='halving'?.5:2;return value;
}
export function mathematicalScaleMaximum(anchor:number,mode:Exclude<MathematicalScaleMode,'value'>,domain:MathematicalDomain){
 if(!Number.isFinite(anchor)||anchor===0)return 0;
 if(mode==='division'){const boundary=anchor>0?Math.max(0,domain.min):Math.max(0,-domain.max);return Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,domain.integer?Math.floor(Math.abs(anchor)):Number.MAX_SAFE_INTEGER,boundary>0?Math.floor(Math.abs(anchor)/boundary):Number.MAX_SAFE_INTEGER));}
 if(!mathematicalValueAllowed(anchor,domain))return 0;
 let value=anchor,count=0;while(count<2048){const next=value*(mode==='halving'?.5:2);if(next===0||next===value||!mathematicalValueAllowed(next,domain))break;value=next;count++;}return count;
}
export function mathematicalValueRejection(value:number,domain:MathematicalDomain){
 if(!Number.isFinite(value))return 'Enter a finite number.';
 if(value<domain.min)return `Minimum value is ${domain.min}.`;
 if(value>domain.max)return `Maximum value is ${domain.max}.`;
 if(Math.abs(value)>Number.MAX_SAFE_INTEGER)return 'Value exceeds safe numeric precision.';
 if(domain.integer&&!Number.isSafeInteger(value))return 'This value must be a whole number.';
 return undefined;
}
/** Draw only rings containing committed marks. The next band remains interactive without a rim. */
export function mathematicalRingOrders(keys:readonly string[],limit=Number.MAX_SAFE_INTEGER){return Math.min(limit,Math.max(1,...keys.map(key=>Number(key.split(':')[0])+1)));}

export function mathematicalScaleRejection(anchor:number,count:number,mode:Exclude<MathematicalScaleMode,'value'>,domain:MathematicalDomain){
 const name=mode==='halving'?'halves':mode==='division'?'divisor':'doublings';
 if(mode==='division'&&count<1)return 'Use a positive whole-number divisor.';
 if(!Number.isSafeInteger(count)||count<0)return `Use a non-negative whole number of ${name}.`;
 const maximum=mathematicalScaleMaximum(anchor,mode,domain);
 if(count>maximum)return `Maximum ${name} is ${maximum}. ${domain.integer?'The next result would be fractional or outside the allowed range.':'The next result is outside the allowed range.'}`;
 return mathematicalValueRejection(mathematicalScaleValue(anchor,count,mode),domain);
}
export function mathematicalLimitsRejection(min:number,max:number,domain:MathematicalDomain){
 if(!Number.isFinite(min)||!Number.isFinite(max))return 'Limits must be finite numbers.';
 if(min>max)return 'Minimum cannot exceed maximum.';
 return mathematicalValueRejection(min,domain)??mathematicalValueRejection(max,domain);
}
