export type HeldActionSnapshot<Action extends string> = {
  readonly actions: readonly Action[];
  readonly generation: number;
};

/** Physical input state, independent of operating-system repeat rate. Consumers
 * sample it for bounded frame work; repeated key events never enqueue actions. */
export function createHeldActions<Action extends string>() {
  const codes = new Map<string, Action>(), listeners = new Set<() => void>();
  let snapshot: HeldActionSnapshot<Action> = { actions: [], generation: 0 };
  const publish = (force = false) => {
    const next = new Set(codes.values());
    const actions = snapshot.actions.filter(action => next.has(action));
    for (const action of next) if (!actions.includes(action)) actions.push(action);
    if (!force && actions.length === snapshot.actions.length && actions.every((action, index) => action === snapshot.actions[index])) return;
    snapshot = { actions, generation: snapshot.generation + 1 };
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    press: (action: Action, code: string, repeat = false) => {
      if (repeat || codes.has(code)) return false;
      codes.set(code, action); publish(); return true;
    },
    release: (code: string) => {
      if (!codes.delete(code)) return false;
      publish(); return true;
    },
    // Force invalidation even when empty: a consumer may still have frame work
    // captured before a blur, hidden page or context transition.
    stop: () => { codes.clear(); publish(true); },
  };
}
export type HeldActions<Action extends string> = ReturnType<typeof createHeldActions<Action>>;
