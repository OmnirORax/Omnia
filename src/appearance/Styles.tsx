import { useMemo } from "react";
import { fontFamily } from "../fonts";
import { connected } from "./model";
import { useAppearance } from "./Context";
import { tint } from "./resolve";
import { brightHex } from "./resolve";
import { ScopedTextAppearance } from "./ScopedTextAppearance";
import { partSelector, scopeDepth } from "./partScope";
import { TARGETS } from "./registry";

/** Renderer adapter: styling bindings are declared alongside registered targets. */
export function AppearanceStyles() {
  const context = useAppearance();
  const css = useMemo(() => {
    if (!context || context.safe) return "";
    const { legacyBase: base, state, targets } = context,
      rules: string[] = ["body *{--omnium-custom-shadow:0 0 0 transparent}"];
    const read = context.read, index = context.hierarchy.index;
    for (const target of [...targets].sort(
      (a, b) => (a.instance ? scopeDepth(a.instance) : -1) - (b.instance ? scopeDepth(b.instance) : -1),
    )) {
      const binding = target.binding;
      if (target.instance?.part?.text !== undefined) continue;
      if (target.aggregate && !target.instance) continue;
      if (!binding?.selector || !binding.css || !target.properties) continue;
      const values = state.values[target.id] ?? {};
      const icon = binding.animation?.kind === "icons" && binding.css === "color";
      const active = target.properties
        .filter(
          (p) =>
            !["effect", "speed", "intensity", "density", "size", "length"].includes(p) &&
            !p.startsWith("effect"),
        )
        .some((p) => values[p] !== undefined || !connected(state, targets, target.id, p, index));
      const legacyText = !!binding.text && (base.textColor !== undefined || base.textGlow > 0);
      // Always establish an icon's own ink, even before it has an override.
      // Otherwise currentColor falls through to a styled text container.
      if (!active && !legacyText && !icon) continue;
      const color = read(target, "color") as string,
        brightness = read(target, "brightness") as number,
        opacity = read(target, "opacity") as number,
        glow = read(target, "glow") as number;
      const owner = target.instance?.owner;
      const scope = owner
        ? owner.startsWith("function:")
          ? `[data-ui-function="${CSS.escape(owner.slice(9))}"]`
          : `:is([data-ui-resident-root="${CSS.escape(owner)}"],[data-ui-proxy-for="${CSS.escape(owner)}"])`
        : undefined;
      // Keep the source binding's specificity while restricting its match to
      // the exact address, so a broad local rule cannot override a narrower edit.
      const baseSelector = target.instance?.part ? TARGETS.find(base => base.id === target.instance!.base)?.binding?.selector?.replace(/::placeholder/g, "") : undefined;
      const selector = target.instance?.part
        ? `${partSelector(target.instance)}:is(:where(*),${baseSelector ?? "*"})${target.instance.base === "text.ui.placeholders" ? "::placeholder" : ""}` : scope
        ? `:is(${scope}:is(${binding.selector}),${scope} :is(${binding.selector}))`
        : `:is(${binding.selector})`;
      const rawSelector = target.instance?.part ? selector : binding.selector.includes("::")
        ? binding.selector
            .split(",")
            .map((part) => (scope ? `${scope} ${part}` : part))
            .join(",")
        : selector;
      const rootSelector = target.instance?.part && target.instance.owner === "app"
        ? ":root[data-omnium-theme]" : ":root[data-omnium-theme] body";
      const declarations: string[] = [];
      const get = (p: string) => read(target, p);
      const custom = (p: string) =>
        values[p] !== undefined || !connected(state, targets, target.id, p, index);
      if (!binding.text || ["color", "brightness", "opacity"].some(custom) || legacyText)
        declarations.push(`${binding.css}:${tint(color, brightness, opacity)} !important`);
      if (icon) {
        declarations.push("text-shadow:none !important", "font-family:system-ui !important", "letter-spacing:normal !important",
          `filter:saturate(${Number(get("saturation"))})${glow > 0 ? ` drop-shadow(0 0 ${glow * 8}px ${color})` : ""} !important`);
      } else if (binding.text) {
        if (["glow", "color", "brightness", "opacity"].some(custom) || legacyText)
          declarations.push(`text-shadow:${glow > 0 ? `0 0 ${glow * 10}px ${color}` : "none"} !important`);
        if (custom("font"))
          declarations.push(
            `font-family:${fontFamily(read(target, "font"))} !important`,
          );
        for (const [p, css, suffix] of [
          ["textSize", "font-size", "px"],
          ["textWeight", "font-weight", ""],
          ["textSpacing", "letter-spacing", "px"],
        ])
          if (custom(p) && target.properties.includes(p))
            declarations.push(`${css}:${get(p)}${suffix} !important`);
      } else {
        if (binding.css === "border-color") {
          if (custom("contourWidth"))
            declarations.push(`border-width:${get("contourWidth")}px !important`);
          if (custom("contourStyle"))
            declarations.push(`border-style:${get("contourStyle")} !important`);
        }
        if (binding.css === "background-color") {
          if (custom("rounding"))
            rules.push(
              `${rootSelector} ${rawSelector}:not(.shape-circle,.shape-triangle,input[type="color"],.shape-circle button,.shape-triangle button){border-radius:${get("rounding")}px !important}`,
            );
          if (["gradient", "gradientColor", "gradientAngle"].some(custom))
            declarations.push(
              `background-image:${get("gradient") ? `linear-gradient(${get("gradientAngle")}deg,${tint(color, brightness, opacity)},${tint(String(get("gradientColor")), brightness, opacity)})` : "none"} !important`,
            );
          if (["shadowStrength", "shadowSpread", "shadowX", "shadowY"].some(custom))
            declarations.push(
              `--omnium-custom-shadow:${get("shadowX")}px ${get("shadowY")}px 12px ${get("shadowSpread")}px rgba(0,0,0,${get("shadowStrength")})`,
            );
        }
        declarations.push(
          `${binding.css === "accent-color" ? "filter" : "box-shadow"}:${glow > 0 ? (binding.css === "accent-color" ? `drop-shadow(0 0 ${glow * 7}px ${color})` : `var(--omnium-custom-shadow),0 0 ${glow * 14}px ${tint(color, brightness, 0.45)}`) : binding.css === "accent-color" ? "none" : "var(--omnium-custom-shadow)"} !important`,
        );
        if (target.properties.includes("blur"))
          declarations.push(
            `backdrop-filter:blur(${Number(read(target, "blur"))}px) !important`,
          );
      }
      rules.push(`${rootSelector} ${rawSelector}{${declarations.join(";")}}`);
    }
    const thumb = targets.find((t) => t.id === "ui.scrollbars.thumb")!,
      track = targets.find((t) => t.id === "ui.scrollbars.track")!;
    if (state.values[thumb.id] || state.values[track.id]) {
      const ink = (t: typeof thumb) =>
        tint(
          read(t, "color") as string,
          Number(read(t, "brightness")),
          Number(read(t, "opacity")),
        );
      rules.push(`:root[data-omnium-theme] *{scrollbar-color:${ink(thumb)} ${ink(track)}}`);
    }
    return rules.join("\n");
  }, [context?.legacyBase, context?.state.values, context?.state.disconnected, context?.targets, context?.safe]);
  return <><style data-appearance-registry>{css}</style><ScopedTextAppearance /></>;
}
export function useIconTint(owner: string, fallbackOwner?: string) {
  return iconTintFor(useAppearance(), owner, fallbackOwner);
}
/** Shared by React artwork and the native-button adapter. */
export function iconTintFor(ctx: ReturnType<typeof useAppearance>, owner: string, fallbackOwner?: string) {
  if (!ctx || ctx.safe) return {};
  const instance = ctx.targets.find(
    (t) => t.instance?.base === "symbols.ui" && t.instance.owner === owner && !t.instance.part,
  );
  const fallback = fallbackOwner
    ? ctx.targets.find(
        (t) => t.instance?.base === "symbols.ui" && t.instance.owner === fallbackOwner && !t.instance.part,
      )
    : undefined;
  const target = instance ?? fallback ?? ctx.targets.find((t) => t.id === "symbols.ui");
  if (!target) return {};
  const read = ctx.read;
  const get = (p: string) => read(target, p);
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
      `${color ? "" : `brightness(${brightness}) `}saturate(${Number(get("saturation"))}) ${glow > 0 ? `drop-shadow(0 0 ${glow * 8}px ${color ?? get("color")})` : ""}`.trim() ||
      undefined,
  };
  return { color, glyphColor: String(get("color")), style };
}
