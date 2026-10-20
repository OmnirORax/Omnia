import type { WorkspaceSettings } from "../workspaceActions";
import { resolveTargetSparkles, type AnimationTarget } from "../graph/effects.ts";
import { connected, type Controller, type Value } from "./model.ts";
import { controllerTargets, propertyFor, TARGETS, type RegisteredTarget } from "./registry.ts";
export type Appearance = WorkspaceSettings["appearance"];
export function legacyValue(base: Appearance, target: RegisteredTarget, property: string): Value {
  const key = target.binding?.legacy ?? "accent",
    node = key.startsWith("nodes") ? base.nodes : base.binders;
  if (key.startsWith("vfx.")) {
    const fx = resolveTargetSparkles(base, key.slice(4) as AnimationTarget);
    const map: Record<string, Value | undefined> = {
      color: fx.color ?? base.accent,
      effect: fx.effect,
      speed: fx.motion,
      intensity: fx.intensity,
      density: fx.density,
      size: fx.starSize ?? 1,
      length: fx.boltLength ?? 0.35,
      brightness: fx.brightness ?? 1,
      opacity: fx.opacity ?? 1,
      glow: fx.glow ?? base.glow,
    };
    return map[property] ?? propertyFor(property)?.initial ?? 0;
  }
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
  const targets = controllerTargets(state),
    fallback = target.instance
      ? (TARGETS.find((t) => t.id === target.instance!.base) ?? target)
      : target;
  if (!connected(state, targets, target.id, property))
    return propertyFor(property)?.neutral ?? legacyValue(base, fallback, property);
  return (
    state.values[target.id]?.[property] ??
    (target.instance ? state.values[target.instance.base]?.[property] : undefined) ??
    legacyValue(base, fallback, property)
  );
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
  for (const target of TARGETS.filter((t) => t.properties)) {
    const values: Record<string, Value> = {};
    for (const property of target.properties!)
      values[property] = valueFor(base, state, target, property);
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
    if (target.id.startsWith("vfx.")) {
      const name = target.id.slice(4) as AnimationTarget;
      const effects = {
        effect: values.effect as Appearance["effect"],
        color: brightHex(values.color as string, values.brightness as number),
        opacity: values.opacity as number,
        glow: values.glow as number,
        brightness: 1,
        motion: values.speed as number,
        intensity: values.intensity as number,
        density: values.density as number,
        starSize: values.size as number,
        boltLength: values.length as number,
      };
      if (name === "nodes" || name === "binders") out[name] = { ...out[name], effects };
      else out.surfaceEffects[name] = effects;
      // Keep the existing per-category switch when no controller override exists.
      out.effectTargets[name] =
        base.effectTargets[name] && connected(state, [...TARGETS], target.id, "effect");
      if (state.values[target.id]?.effect !== undefined && effects.effect !== "off")
        out.effectTargets[name] = connected(state, [...TARGETS], target.id, "effect");
    }
  }
  const glowValues = TARGETS.filter(
    (t) => t.id.startsWith("omnium.") || t.id === "vfx.nodes" || t.id === "vfx.binders",
  )
    .filter((t) => state.values[t.id]?.glow !== undefined)
    .map((t) => Number(out.renderDefaults[t.id]?.glow ?? 0));
  if (glowValues.length) out.glow = Math.min(1, Math.max(base.glow, ...glowValues));
  return out;
}
