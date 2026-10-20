import type { Controller, Rule, Values } from "./model.ts";
const rename = (p: string) =>
  (
    ({
      color: "effectColor",
      brightness: "effectBrightness",
      opacity: "effectOpacity",
      glow: "effectGlow",
    }) as Record<string, string>
  )[p] ?? p;
/** Move the former VFX targets into properties on real targets. Idempotent. */
export function migrateEffects(
  state: Controller,
  mapping: Record<string, { id: string; glyphsOnly?: boolean; effectKinds?: readonly string[] }[]>,
  properties: string[],
): Controller {
  const glyph = (values: Values) =>
    values.effect === "electric-text" || values.effect === "lightning";
  const remapValues = (values: Values, glyphsOnly?: boolean) =>
    Object.fromEntries(
      Object.entries(values)
        .filter(
          ([key]) => !glyphsOnly || key !== "effect" || glyph(values) || values.effect === "off",
        )
        .map(([key, value]) => [rename(key), value]),
    );
  const remapRule = (rule: Rule) => ({
    all: false,
    properties: rule.all ? properties : [...new Set((rule.properties ?? []).map(rename))],
  });
  const mergeRule = (a: Rule | undefined, b: Rule): Rule =>
    a?.all
      ? a
      : {
          all: false,
          properties: [...new Set([...(a?.properties ?? []), ...(b.properties ?? [])])],
        };
  for (const [old, destinations] of Object.entries(mapping)) {
    for (const dest of destinations) {
      if (state.values[old]) {
        const values = remapValues(state.values[old], dest.glyphsOnly);
        if (values.effect && !dest.effectKinds?.includes(String(values.effect)))
          values.effect = "off";
        state.values[dest.id] = { ...values, ...state.values[dest.id] };
      }
      for (const field of ["locks", "disconnected"] as const)
        for (const key of ["vfx", old])
          if (state[field][key])
            state[field][dest.id] = mergeRule(state[field][dest.id], remapRule(state[field][key]));
    }
    for (const [id, instance] of Object.entries(state.instances))
      if (instance.base === old) {
        for (const dest of destinations) {
          const nextId = `${dest.id}@@${encodeURIComponent(instance.owner)}`;
          state.instances[nextId] ??= { ...instance, base: dest.id };
          const values = remapValues(state.values[id] ?? {}, dest.glyphsOnly);
          if (values.effect && !dest.effectKinds?.includes(String(values.effect)))
            values.effect = "off";
          state.values[nextId] = { ...values, ...state.values[nextId] };
          state.refined[nextId] = [
            ...new Set([
              ...(state.refined[nextId] ?? []),
              ...(state.refined[id] ?? []).map(rename),
            ]),
          ];
          for (const field of ["locks", "disconnected"] as const)
            if (state[field][id])
              state[field][nextId] = mergeRule(state[field][nextId], remapRule(state[field][id]));
        }
        delete state.instances[id];
        delete state.values[id];
        delete state.refined[id];
        delete state.locks[id];
        delete state.disconnected[id];
      }
  }
  for (const set of state.sets) {
    for (const [key, on] of Object.entries(set.selection)) {
      const destinations = key === "vfx" ? Object.values(mapping).flat() : mapping[key];
      if (!destinations) continue;
      for (const dest of destinations)
        if (set.selection[dest.id] === undefined) set.selection[dest.id] = on;
      delete set.selection[key];
    }
    if (set.only === "vfx") set.only = "all";
    else if (set.only && mapping[set.only]) set.only = mapping[set.only][0]?.id;
  }
  for (const key of ["vfx", ...Object.keys(mapping)])
    for (const field of ["values", "locks", "disconnected", "refined"] as const)
      delete state[field][key];
  return state;
}
