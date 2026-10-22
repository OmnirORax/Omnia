import { defineFunction } from "../properties/function.ts";
/** Runtime input profile for the mouse effect; discovery and coupling use these same fields. */
export default defineFunction({
  id: "ui.mouse.trail", label: "Mouse trail", owner: "appearance", locator: ".mouse-trail",
  group: [{ id: "ui", label: "Windows / frames / controls" }, { id: "ui.mouse", label: "Mouse" }],
  inputs: {
    effect: { initial: "off", choices: ["off", "lightning", "stars"] },
    speed: { initial: .25 }, intensity: { initial: .5 }, density: { initial: 1 },
    size: { initial: 1 }, length: { initial: .35 }, effectColor: { initial: "#60ddec" },
    effectBrightness: { initial: 1 }, effectOpacity: { initial: 1 }, effectGlow: { initial: .5 },
  },
});
