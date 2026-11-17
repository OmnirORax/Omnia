import {mathematicalEditValue,mathematicalValueAllowed,type MathematicalDomain} from './mathematicalDial.ts';
export type DialValueGrid={domain:MathematicalDomain;equilibrium:number;snap:number};
/** The bounded trial's one value lattice. No stored value is changed by inspection. */
export function dialValueGrid(domain:MathematicalDomain,snap?:number):DialValueGrid{
 const midpoint=domain.min/2+domain.max/2,span=domain.max-domain.min;
 return {domain,equilibrium:domain.integer?Math.round(midpoint):midpoint,snap:snap??(domain.integer?1:span>0?span/8:1)};
}
export function dialSnapDomain(domain:MathematicalDomain):MathematicalDomain{return {min:domain.integer?1:Number.MIN_VALUE,max:Math.max(domain.integer?1:0,domain.max-domain.min),integer:domain.integer};}
export function dialGridValue(grid:DialValueGrid,count:number){return mathematicalEditValue({anchor:grid.equilibrium,index:count,rule:{kind:'increment',amount:grid.snap}});}
export function dialGridCount(grid:DialValueGrid,value:number){return Math.round((value-grid.equilibrium)/grid.snap);}
/** Clamp the index, never the result: endpoints must belong to the lattice too. */
export function nearestDialValue(grid:DialValueGrid,value:number){
 if(!Number.isFinite(grid.snap)||grid.snap<=0)return NaN;
 let low=Math.ceil((grid.domain.min-grid.equilibrium)/grid.snap-1e-12),high=Math.floor((grid.domain.max-grid.equilibrium)/grid.snap+1e-12);
 if(dialGridValue(grid,low)<grid.domain.min)low++;if(dialGridValue(grid,high)>grid.domain.max)high--;
 if(low>high)return NaN;
 const n=dialGridValue(grid,Math.max(low,Math.min(high,dialGridCount(grid,value))));return mathematicalValueAllowed(n,grid.domain)?n:NaN;
}

/** Scratch owner shared by miniature fields: no migration/write until acceptance. */
export function createDialValueDraft(options:{domain:MathematicalDomain;value:number;snap?:number;represented?:boolean;preview:(n:number)=>void;restore:()=>void;commit:(n:number)=>void|boolean}){
 let grid=dialValueGrid(options.domain,options.snap!==undefined&&mathematicalValueAllowed(options.snap,dialSnapDomain(options.domain))?options.snap:undefined),candidate=options.represented&&mathematicalValueAllowed(options.value,options.domain)?options.value:nearestDialValue(grid,options.value),chosen=false,finished=false;
 const frozen=candidate;
 return {get grid(){return grid;},get candidate(){return candidate;},frozen,get finished(){return finished;},
  hover(n:number){if(!finished&&mathematicalValueAllowed(n,options.domain))options.preview(n);},
  choose(n:number){if(finished||!mathematicalValueAllowed(n,options.domain))return false;candidate=n;chosen=true;options.preview(n);return true;},
  restorePreview(){if(finished)return;if(chosen)options.preview(candidate);else options.restore();},
  setSnap(n:number){if(!mathematicalValueAllowed(n,dialSnapDomain(options.domain)))return false;const next=dialValueGrid(options.domain,n),nextValue=nearestDialValue(next,chosen?candidate:options.value);if(!mathematicalValueAllowed(nextValue,options.domain))return false;grid=next;candidate=nextValue;chosen=false;options.restore();return true;},
  accept(){if(finished||!mathematicalValueAllowed(candidate,options.domain))return false;finished=true;if(options.commit(candidate)===false){finished=false;return false;}return true;},
  cancel(){if(finished)return;finished=true;options.restore();},
 };
}
