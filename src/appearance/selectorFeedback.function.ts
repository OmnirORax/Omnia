import { defineFunction } from "../properties/function.ts";

/** One configurable pulse function; paint tones retain their independent values. */
export default defineFunction({
  id: "ui.guides.selector.pulse", label: "Pulse", owner: "appearance",
  locator: ".visual-selection-overlay,.selector-feedback-sample",
  group: [
    { id: "ui", label: "Windows / frames / controls" },
    { id: "ui.guides", label: "UI arrangement indicators" },
    { id: "ui.guides.selector", label: "Selector feedback", self: true },
  ],
  inputs: {
    pulse: { definition: { id: "pulse", label: "Pulse", kind: "toggle", initial: true, neutral: false,
      category: { id: "visual", label: "Visuals" } } },
    speed: { initial: .25 },
    intensity: { initial: .3 },
  },
});
