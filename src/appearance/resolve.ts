import type { WorkspaceSettings } from "../workspaceActions";
import {
  resolveTargetSparkles,
  type AnimationTarget,
  type SparkleStyle,
} from "../graph/effects.ts";
import { connected, ruleHas, type Controller, type Value } from "./model.ts";
import { scopeContains } from "./partScope.ts";
import {
  controllerTargets,
  propertyFor,
  TARGETS,
  type RegisteredTarget,
  EFFECT_PROPERTIES,
} from "./registry.ts";
export type Appearance = WorkspaceSettings["appearance"];
const glyphEffect = (effect: string) => effect === "electric-text" || effect === "lightning";
function legacyEffects(base: Appearance, target: RegisteredTarget): SparkleStyle {
  const binding = target.binding?.animation;
  const fx = resolveTargetSparkles(base, binding?.source ?? "windows");
  if (!binding?.source) return { ...fx, effect: "off" };
  if (binding.glyphsOnly && !glyphEffect(fx.effect)) {
    const windows = resolveTargetSparkles(base, "windows");
    return target.id.startsWith("text.ui.") || target.id === "symbols.ui"
      ? glyphEffect(windows.effect)
        ? windows
        : { ...fx, effect: "off" }
      : { ...fx, effect: "off" };
  }
  return fx;
}
/** The same animation properties are consumed by every renderer. */
export function effectsFor(theme: Appearance, id: string | RegisteredTarget): SparkleStyle {
  const target = typeof id === "string" ? TARGETS.find((t) => t.id === id)! : id;
  const values = !target.instance ? theme.renderDefaults?.[target.id] : undefined;
  let resolve: ReturnType<typeof createValueResolver> | undefined;
  const get = (p: string) =>
    values?.[p] ??
    (theme.controller
      ? (resolve ??= createValueResolver(theme, theme.controller))(target, p)
      : legacyValue(theme, target, p));
  return effectsFromValues(get);
}
export function effectsFromValues(get: (property: string) => Value): SparkleStyle {
  const effect = get("effect") as SparkleStyle["effect"];
  return {
    effect,
    color: brightHex(get("effectColor") as string, Number(get("effectBrightness"))),
    brightness: 1,
    opacity: Number(get("effectOpacity")),
    glow: Number(get("effectGlow")),
    motion: Number(get("speed")),
    intensity: Number(get("intensity")),
    density: Math.min(effect === "starfield" ? 4 : 1, Number(get("density"))),
    starSize: Number(get("size")),
    boltLength: Number(get("length")),
  };
}
export function legacyValue(base: Appearance, target: RegisteredTarget, property: string): Value {
  if (target.defaults?.[property] !== undefined) return target.defaults[property];
  const key = target.binding?.legacy ?? "accent",
    node = key.startsWith("nodes") ? base.nodes : base.binders;
  if (EFFECT_PROPERTIES.includes(property)) {
    const fx = legacyEffects(base, target);
    const map: Record<string, Value | undefined> = {
      effect: fx.effect,
      speed: fx.motion,
      intensity: fx.intensity,
      density: fx.density,
      size: fx.starSize ?? 1,
      length: fx.boltLength ?? 0.35,
      effectColor: fx.color ?? base.accent,
      effectBrightness: fx.brightness ?? 1,
      effectOpacity: fx.opacity ?? 1,
      effectGlow: fx.glow ?? base.glow,
    };
    return map[property] ?? propertyFor(property)?.initial ?? 0;
  }
  if (property === "contourWidth" && target.id === "omnium.binders.path") return 1.5;
  if (property === "font") return base.font;
  if (property === "brightness") return 1;
  if (property === "blur") return base.blur;
  if (property === "opacity")
    return target.id.startsWith("symbols.")
      ? 1
      : key.startsWith("nodes")
        ? base.nodes.opacity
        : key.startsWith("binders")
          ? base.binders.opacity
          : target.id === "ui.windows.background"
            ? base.windowOpacity
            : 1;
  if (property === "glow")
    return target.binding?.text || key === "nodeText" || key === "binderText"
      ? base.textGlow
      : key.startsWith("nodes")
        ? base.nodes.glow
        : key.startsWith("binders")
          ? base.binders.glow
          : base.glow;
  if (property !== "color") return propertyFor(property)?.initial ?? 0;
  if (key === "background") return base.background;
  if (
    key === "windowBackground" ||
    key === "fieldBackground" ||
    key === "controlBackground" ||
    key === "headerBackground"
  )
    return base.background;
  if (key === "textColor" || key === "nodeText" || key === "binderText")
    return (
      base.textColor ??
      (key === "textColor"
        ? base.theme === "neon"
          ? "#d7f3f7"
          : "#233348"
        : (base.nodes.color ?? (base.theme === "neon" ? base.accent : "#dce9fa")))
    );
  if (key.endsWith(".color"))
    return (
      node.color ??
      (base.theme === "neon" ? base.accent : key.startsWith("nodes") ? "#dce9fa" : "#9fc4e9")
    );
  return base.accent;
}
export function valueFor(
  base: Appearance,
  state: Controller,
  target: RegisteredTarget,
  property: string,
): Value {
  return createValueResolver(base, state)(target, property);
}
/** Reuse registry, ancestry and scope lookups for a render/transaction. Values stay live. */
export function createValueResolver(base: Appearance, state: Controller, targets = controllerTargets(state)) {
  const byId = new Map(targets.map(target => [target.id, target]));
  const bases = new Map(TARGETS.map(target => [target.id, target]));
  const paths = new Map<string, string[]>(), parents = new Map<string, RegisteredTarget[]>();
  const locals = new Map<string, RegisteredTarget[]>();
  for (const target of targets) if (target.instance)
    locals.set(target.instance.base, [...(locals.get(target.instance.base) ?? []), target]);
  const pathFor = (target: RegisteredTarget) => {
    let path = paths.get(target.id);
    if (path) return path;
    path = [];
    const seen = new Set<string>();
    let current: RegisteredTarget | undefined = target;
    if (target.instance && !byId.has(target.id)) {
      path.push(target.id); current = bases.get(target.instance.base);
    }
    while (current && !seen.has(current.id)) {
      seen.add(current.id); path.unshift(current.id); current = current.parent ? byId.get(current.parent) : undefined;
    }
    paths.set(target.id, path); return path;
  };
  const isConnected = (target: RegisteredTarget, property: string) =>
    !pathFor(target).some(id => ruleHas(state.disconnected[id], property));
  const resolve = (target: RegisteredTarget, property: string): Value => {
    const channel = target.couplings?.[property];
    if (channel && channel !== property) {
      if (!isConnected(target, property)) return propertyFor(property)?.neutral ?? legacyValue(base, target, property);
      return resolve(target, channel);
    }
    const fallback = target.instance
      ? (bases.get(target.instance.base) ?? target)
      : target;
    if (!isConnected(target, property) || Object.entries(target.couplings ?? {}).some(([source, channel]) => channel === property && !isConnected(target, source)))
      return propertyFor(property)?.neutral ?? legacyValue(base, fallback, property);
    if (target.instance?.part && state.values[target.id]?.[property] === undefined) {
      const instance = target.instance;
      const rank = (candidate: RegisteredTarget) => candidate.instance!.owner === instance.owner
        ? 1000 + (candidate.instance!.part?.steps.length ?? -1) + Number(candidate.instance!.part?.text !== undefined) / 2
        : (instance.path?.indexOf(candidate.instance!.owner) ?? -1);
      let broader = parents.get(target.id);
      if (!broader) {
        broader = (locals.get(instance.base) ?? []).filter(candidate => {
          const parent = candidate.instance;
          return parent && parent.base === instance.base && candidate.id !== target.id && scopeContains(parent, instance) &&
            (!parent.part || parent.part.steps.length < instance.part!.steps.length ||
              (parent.part.text === undefined && instance.part!.text !== undefined));
        }).sort((a, b) => rank(b) - rank(a));
        parents.set(target.id, broader);
      }
      for (const ancestor of broader)
        if (state.values[ancestor.id]?.[property] !== undefined || !isConnected(ancestor, property))
          return resolve(ancestor, property);
    }
    return (
      state.values[target.id]?.[property] ??
      (target.instance ? state.values[target.instance.base]?.[property] : undefined) ??
      legacyValue(base, fallback, property)
    );
  };
  return resolve;
}
export function tint(color: string, brightness: number, opacity = 1): string {
  const n = parseInt(color.slice(1), 16);
  const r = Math.min(255, Math.round((n >> 16) * brightness)),
    g = Math.min(255, Math.round(((n >> 8) & 255) * brightness)),
    b = Math.min(255, Math.round((n & 255) * brightness));
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
export function brightHex(color: string, brightness: number): string {
  const n = parseInt(color.slice(1), 16);
  return (
    "#" +
    [n >> 16, (n >> 8) & 255, n & 255]
      .map((v) =>
        Math.min(255, Math.max(0, Math.round(v * brightness)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function resolveControllerAppearance(base: Appearance): Appearance {
  const state = base.controller;
  if (!state) return base;
  const out = {
    ...base,
    nodes: { ...base.nodes },
    binders: { ...base.binders },
    effectTargets: { ...base.effectTargets },
    surfaceEffects: { ...base.surfaceEffects },
    renderDefaults: {} as Record<string, Record<string, Value>>,
  };
  const resolve = createValueResolver(base, state);
  for (const target of TARGETS.filter((t) => t.properties)) {
    const values: Record<string, Value> = {};
    for (const property of target.properties!)
      values[property] = resolve(target, property);
    out.renderDefaults[target.id] = values;
    const custom = state.values[target.id] || !connected(state, [...TARGETS], target.id, "color");
    if (target.id === "workspace.background" && custom)
      out.background = brightHex(values.color as string, values.brightness as number);
    if (target.id === "omnium.nodes.body") {
      out.nodes = {
        ...out.nodes,
        color:
          state.values[target.id] || !connected(state, [...TARGETS], target.id, "color")
            ? brightHex(values.color as string, values.brightness as number)
            : base.nodes.color,
        opacity: values.opacity as number,
        glow: values.glow as number,
      };
    }
    if (target.id === "omnium.binders.path") {
      out.binders = {
        ...out.binders,
        color:
          state.values[target.id] || !connected(state, [...TARGETS], target.id, "color")
            ? brightHex(values.color as string, values.brightness as number)
            : base.binders.color,
        opacity: values.opacity as number,
        glow: values.glow as number,
      };
    }
  }
  // Compatibility for existing render paths; the editable data stays on real targets.
  for (const [name, id] of Object.entries({
    nodes: "omnium.nodes.body",
    binders: "omnium.binders.path",
    background: "workspace.background",
    windows: "ui.windows.contour",
    buttons: "ui.buttons.contour",
    fields: "ui.fields.single.contour",
  })) {
    const effects = effectsFor(out, id);
    if (name === "nodes" || name === "binders") out[name] = { ...out[name], effects };
    else out.surfaceEffects[name as "windows" | "buttons" | "fields" | "background"] = effects;
    out.effectTargets[name as AnimationTarget] = effects.effect !== "off";
  }
  const glowValues = TARGETS.filter(
    (t) =>
      t.id.startsWith("omnium.") ||
      t.id === "text.nodes" ||
      t.id === "text.binders" ||
      t.id.startsWith("symbols."),
  )
    .filter(
      (t) => state.values[t.id]?.glow !== undefined || state.values[t.id]?.effectGlow !== undefined,
    )
    .map((t) =>
      Math.max(
        Number(out.renderDefaults[t.id]?.glow ?? 0),
        Number(out.renderDefaults[t.id]?.effectGlow ?? 0),
      ),
    );
  if (glowValues.length) out.glow = Math.min(1, Math.max(base.glow, ...glowValues));
  return out;
}
