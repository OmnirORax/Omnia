export function createSelection<T>(equal: (a: T, b: T) => boolean) {
  let values: T[] = [];
  let hovered:T[]|undefined;
  let request: { accept: (target: T) => boolean; restore: T[] } | undefined;
  return {
    get values(): readonly T[] { return hovered??values; },
    get committed():readonly T[]{return values;},
    /** Actions retain a committed group while hover stays available independently. */
    get targets():readonly T[]{return values.length>1?values:hovered??values;},
    hover(value:T|undefined){hovered=!request&&value!==undefined?[value]:undefined;},
    has: (value: T) => (hovered??values).some(item => equal(item, value)),
    retain(keep:(value:T)=>boolean){values=values.filter(keep);if(hovered&&!hovered.every(keep))hovered=undefined;},
    clear(){values=[];hovered=undefined;},
    set(next: readonly T[]) { values = next.filter((v, i) => next.findIndex(other => equal(v, other)) === i); },
    pick(value: T, extend = false, toggle = false) {
      if (request) {
        const current = request;
        if (current.accept(value) && request === current) { values = current.restore; request = undefined; }
        return;
      }
      if (toggle && values.some(item => equal(item, value))) values = values.filter(item => !equal(item, value));
      else values = extend || toggle ? [...values.filter(item => !equal(item, value)), value] : [value];
    },
    request(accept: (target: T) => boolean) {
      hovered=undefined;
      if (request) values = request.restore;
      request = { accept, restore: [...values] };
    },
    get requesting() { return !!request; },
    cancel() { if (request) { values = request.restore; request = undefined; return true; } return false; },
  };
}

/** A hover target must not narrow a committed group when its member is picked up. */
export function pickupSelection<T>(committed:readonly T[],target:T,equal:(a:T,b:T)=>boolean):readonly T[]{return committed.some(item=>equal(item,target))?[...committed]:[target];}
