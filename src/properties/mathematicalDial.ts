/** Provisional base-anchored slot grammar, independent of any visual target. */
export type MathematicalSlotMode='normal'|'recursion';
export function mathematicalSlotValue(base:number,ordinal:number,mode:MathematicalSlotMode){
 return mode==='recursion'?base**ordinal:base*ordinal;
}
/** Maximum equally sized non-overlapping circles on a ring of centre radius r. */
export function radialSlotCapacity(radius:number,diameter:number){
 if(radius<=0||diameter<=0||diameter>2*radius)return 1;
 return Math.max(1,Math.floor(Math.PI/Math.asin(diameter/(2*radius))+1e-9));
}
