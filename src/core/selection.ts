export function createSelection<T>(equal: (a: T, b: T) => boolean) {
  let values: T[] = [];
  let request: { accept: (target: T) => boolean; restore: T[] } | undefined;
  return {
    get values(): readonly T[] { return values; },
    has: (value: T) => values.some(item => equal(item, value)),
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
      if (request) values = request.restore;
      request = { accept, restore: [...values] };
    },
    get requesting() { return !!request; },
    cancel() { if (request) { values = request.restore; request = undefined; return true; } return false; },
  };
}
