/** Highest priority wins; equal priorities use the most recently activated owner. */
export function activeToolCursor<T extends {priority?:number}>(requests:Iterable<T>):T|null {
  let current:T|null=null;
  for(const request of requests)if(!current||(request.priority??0)>=(current.priority??0))current=request;
  return current;
}
