/** Pointer feedback is not saved UI state and must not rerender the workspace provider. */
export function createTransientStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (next: T) => {
      if (Object.is(value, next)) return;
      value = next;
      listeners.forEach((listener) => listener());
    },
  };
}
export type TransientStore<T> = ReturnType<typeof createTransientStore<T>>;
