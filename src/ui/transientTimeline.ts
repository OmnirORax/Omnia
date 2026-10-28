/** Selection history stays transient and independent of document action history. */
export type TransientTimeline<T>={states:T[];index:number};
export function appendTransient<T>(previous:TransientTimeline<T>,next:T):TransientTimeline<T>{
  if(previous.states[previous.index]===next)return previous;
  const states=[...previous.states.slice(0,previous.index+1),next];
  return {states,index:states.length-1};
}
export function stepTransient<T>(previous:TransientTimeline<T>,delta:number):TransientTimeline<T>{
  return {...previous,index:Math.max(0,Math.min(previous.states.length-1,previous.index+delta))};
}
