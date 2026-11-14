import { defineFunction } from "../properties/function.ts";

/** Independent consumer of the shared opacity setter; no duplicate property. */
export default defineFunction({
  id: "ui.guides.selector.backgroundFill", label: "Background fill strength", owner: "appearance",
  locator: ".visual-selection-overlay,.selector-feedback-sample",
  group: [
    { id: "ui", label: "Windows / frames / controls" },
    { id: "ui.guides", label: "UI arrangement indicators" },
    { id: "ui.guides.selector", label: "Selector feedback", self: true },
  ],
  inputs: { opacity: { initial: 0.164 } },
});
