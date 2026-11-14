/** One shared Shift gesture, independent of function renderers and key bindings. */
export type ConfigurationInteraction = {
  cycle: () => void;
  apply: () => void;
  select?: (index: number) => void;
  lock?: () => void;
  reset?: () => void;
};
export function createConfigurationGesture(invoke: (id: string) => void) {
  let active: { id: string; armed: boolean } | null = null;
  let interaction: ConfigurationInteraction | null = null;
  return {
    get active() { return active; },
    begin(id: string, armed = true): "open" | "cycle" {
      if (active?.id === id && armed && active.armed) { interaction?.cycle(); return "cycle"; }
      active = { id, armed }; interaction = null; return "open";
    },
    register(next: ConfigurationInteraction) {
      interaction = next;
      return () => { if (interaction === next) interaction = null; };
    },
    finish() {
      if (!active?.armed) return false;
      const id = active.id, adapter = interaction;
      active = null; interaction = null;
      if (adapter) adapter.apply(); else invoke(id);
      return true;
    },
    cancel() { active = null; interaction = null; },
    lock() {
      if (!active) return false;
      const id = active.id, adapter = interaction;
      active = null; interaction = null;
      adapter?.lock?.();
      if (adapter) adapter.apply(); else invoke(id);
      return true;
    },
    select(index: number) { interaction?.select?.(index); },
    reset() { interaction?.reset?.(); },
  };
}
export type ConfigurationGesture = ReturnType<typeof createConfigurationGesture>;
