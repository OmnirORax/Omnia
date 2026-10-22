import { TARGETS, type RegisteredTarget } from "./registry.ts";
import type { GlyphScope } from "../uiLightning";
export const uiEffectTargets = TARGETS.filter(
  (t) => !t.aggregate && t.binding?.animation && (t.binding.animation.selector || t.binding.selector),
);
const textTargets = uiEffectTargets
  .filter((t) => t.binding?.animation?.kind === "text")
  .sort((a, b) => (b.binding?.animation?.priority ?? 0) - (a.binding?.animation?.priority ?? 0));
export const effectSelector = (target: RegisteredTarget) =>
  (target.binding!.animation!.selector ?? target.binding!.selector!).replace(/::placeholder/g, "");
/** The nearest matching text owner avoids painting nested labels twice. */
export function textOwner(start: HTMLElement) {
  if (start.closest('svg,.function-icon,[data-ui-native-icon],button[data-ui-visual-kind="icon"]')) return;
  let element: HTMLElement | null = start;
  while (element) {
    const target = textTargets.find((t) => {
      if (!element!.matches(effectSelector(t))) return false;
      if (t.id === "text.ui.placeholders")
        return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
          ? !element.value && !!element.placeholder
          : false;
      if (
        t.id === "text.ui.contents" &&
        (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) &&
        !element.value &&
        element.placeholder
      )
        return false;
      return true;
    });
    if (target) return { target, element };
    element = element.parentElement;
  }
}
export function effectScope(target: RegisteredTarget, element: HTMLElement): GlyphScope {
  const kind = target.binding!.animation!.kind;
  if (kind === "text") {
    const owns = (parent: HTMLElement) => {
      const owner = textOwner(parent);
      return owner?.target.id === target.id && owner.element === element;
    };
    return { key: target.id, shape: "glyphs", text: owns, input: owns, icons: false };
  }
  if (kind === "icons")
    return { key: target.id, shape: "glyphs", text: () => false, input: () => false, icons: true };
  return {
    key: target.id,
    shape: target.binding?.css === "background-color" ? "surface" : "contour",
    icons: false,
  };
}
