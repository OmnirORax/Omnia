import { useMemo } from "react";
import { fontFamily } from "../fonts";
import { connected } from "./model";
import { useAppearance } from "./Context";
import { tint, valueFor } from "./resolve";
import { brightHex } from "./resolve";

/** Renderer adapter: styling bindings are declared alongside registered targets. */
export function AppearanceStyles() {
  const context = useAppearance();
  const css = useMemo(() => {
    if (!context) return "";
    const { base, state, targets } = context,
      rules: string[] = [];
    for (const target of [...targets].sort(
      (a, b) =>
        (a.instance?.path?.length ?? -1) +
        (a.instance?.owner.startsWith("function:") ? 1 : 0) -
        (b.instance?.path?.length ?? -1) -
        (b.instance?.owner.startsWith("function:") ? 1 : 0),
    )) {
      const binding = target.binding;
      if (!binding?.selector || !binding.css || !target.properties) continue;
      const values = state.values[target.id] ?? {};
      const local = !!target.instance;
      const active = ["color", "brightness", "opacity", "glow", "blur", "font"].some(
        (p) => values[p] !== undefined || !connected(state, targets, target.id, p),
      );
      const legacyText = !!binding.text && (base.textColor !== undefined || base.textGlow > 0);
      if (!active && !legacyText) continue;
      const color = valueFor(base, state, target, "color") as string,
        brightness = valueFor(base, state, target, "brightness") as number,
        opacity = valueFor(base, state, target, "opacity") as number,
        glow = valueFor(base, state, target, "glow") as number;
      const owner = target.instance?.owner;
      const scope = owner
        ? owner.startsWith("function:")
          ? `[data-ui-function="${CSS.escape(owner.slice(9))}"]`
          : `[data-ui-resident-root="${CSS.escape(owner)}"]`
        : undefined;
      const selector = scope
        ? `:is(${scope}:is(${binding.selector}),${scope} :is(${binding.selector}))`
        : `:is(${binding.selector})`;
      const rawSelector = binding.selector.includes("::")
        ? binding.selector
            .split(",")
            .map((part) => (scope ? `${scope} ${part}` : part))
            .join(",")
        : selector;
      const declarations = [`${binding.css}:${tint(color, brightness, opacity)} !important`];
      if (binding.text) {
        declarations.push(
          `text-shadow:${glow > 0 ? `0 0 ${glow * 10}px ${color}` : "none"} !important`,
        );
        if (values.font !== undefined || local)
          declarations.push(
            `font-family:${fontFamily(valueFor(base, state, target, "font"))} !important`,
          );
      } else {
        declarations.push(
          `${binding.css === "accent-color" ? "filter" : "box-shadow"}:${glow > 0 ? (binding.css === "accent-color" ? `drop-shadow(0 0 ${glow * 7}px ${color})` : `0 0 ${glow * 14}px ${tint(color, brightness, 0.45)}`) : "none"} !important`,
        );
        if (target.properties.includes("blur"))
          declarations.push(
            `backdrop-filter:blur(${Number(valueFor(base, state, target, "blur"))}px) !important`,
          );
      }
      rules.push(`:root[data-omnium-theme] body ${rawSelector}{${declarations.join(";")}}`);
    }
    const thumb = targets.find((t) => t.id === "ui.scrollbars.thumb")!,
      track = targets.find((t) => t.id === "ui.scrollbars.track")!;
    if (state.values[thumb.id] || state.values[track.id]) {
      const ink = (t: typeof thumb) =>
        tint(
          valueFor(base, state, t, "color") as string,
          Number(valueFor(base, state, t, "brightness")),
          Number(valueFor(base, state, t, "opacity")),
        );
      rules.push(`:root[data-omnium-theme] *{scrollbar-color:${ink(thumb)} ${ink(track)}}`);
    }
    return rules.join("\n");
  }, [context]);
  return <style data-appearance-registry>{css}</style>;
}
export function useIconTint(owner: string) {
  const ctx = useAppearance();
  if (!ctx) return {};
  const instance = ctx.targets.find(
    (t) => t.instance?.base === "symbols.ui" && t.instance.owner === owner,
  );
  const target = instance ?? ctx.targets.find((t) => t.id === "symbols.ui");
  if (!target) return {};
  const get = (p: string) => valueFor(ctx.base, ctx.state, target, p);
  const custom = ctx.state.values[target.id] ?? {},
    brightness = Number(get("brightness")),
    glow = Number(get("glow"));
  const color =
    custom.color !== undefined ||
    (!!instance && ctx.state.values[instance.instance!.base]?.color !== undefined)
      ? brightHex(get("color") as string, brightness)
      : undefined;
  const style = {
    opacity: Number(get("opacity")),
    filter:
      `${color ? "" : `brightness(${brightness}) `}${glow > 0 ? `drop-shadow(0 0 ${glow * 8}px ${color ?? get("color")})` : ""}`.trim() ||
      undefined,
  };
  return { color, style };
}
