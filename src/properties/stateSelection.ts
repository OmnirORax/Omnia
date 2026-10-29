/** Generated alternatives are separate from numeric notation and owner setters. */
export type CyclicSelection={period:number;north:number};
export type StateSelectionMode='symmetry'|'halving'|'step';
export const MAX_SELECTION_STATES=64;
export const maximumSelectionStates=(mode:StateSelectionMode)=>mode==='halving'?8:MAX_SELECTION_STATES;
export function selectionTurns(mode:StateSelectionMode,count:number,step:number,period:number):number[]{
 if(!Number.isInteger(count)||count<1||count>maximumSelectionStates(mode)||!Number.isFinite(period)||period<=0)return [];
 if(mode==='step'&&(!Number.isFinite(step)||step<=0||step>period))return [];
 return Array.from({length:count},(_,i)=>mode==='symmetry'?i/count:mode==='halving'?(i===0?0:2**-i):(i*step%period)/period)
  .filter((turn,i,all)=>all.indexOf(turn)===i);
}
export function selectionValue(turn:number,reference:number,domain:CyclicSelection,min:number,max:number){
 const value=reference+turn*domain.period;
 return Number.isFinite(value)&&value>=min&&value<=max?value:undefined;
}
export function selectionExpression(count:number){
 const power=Math.log2(count);
 return Number.isInteger(power)?{base:2,power,count}: {count};
}

/** Size marks from their angular neighbours so dense fractional modes do not
 * retain overlapping full-size buttons. Layout is prepared only on rule changes. */
export function selectionLayout(turns:readonly number[],radius:number){
 const sorted=turns.map((turn,index)=>({turn,index})).sort((a,b)=>a.turn-b.turn),diameters=new Array<number>(turns.length);
 for(let i=0;i<sorted.length;i++){
  const here=sorted[i],before=sorted[(i+sorted.length-1)%sorted.length],after=sorted[(i+1)%sorted.length];
  const gap=sorted.length===1?1:Math.min((here.turn-before.turn+1)%1,(after.turn-here.turn+1)%1);
  diameters[here.index]=Math.max(2,Math.min(15,2*radius*Math.sin(Math.PI*Math.min(gap,.5))*.7));
 }
 return turns.map((turn,i)=>({turn,diameter:diameters[i]}));
}

/** Local angular picking over an already generated, bounded set of states. */
export function nearestSelectionTurn(turns:readonly number[],turn:number){
 if(!Number.isFinite(turn))return;
 let found:number|undefined,distance=Infinity;
 for(const candidate of turns){const delta=Math.abs(((turn-candidate+.5)%1+1)%1-.5);if(delta<distance){distance=delta;found=candidate;}}
 return found;
}
