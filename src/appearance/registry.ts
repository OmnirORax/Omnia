import { EFFECT_KINDS } from "../graph/effects.ts";
import { FONT_OPTIONS, normalizeFont } from "../fonts.ts";
import { type Controller, type Target, type Value, type Values, normalizeController } from "./model.ts";
import { migrateEffects } from "./migrateEffects.ts";
import { migrateFieldBranches } from "./migrateFields.ts";
import type { AnimationTarget } from "../graph/effects.ts";
export type Property = {
  id: string;
  label: string;
  kind: "color" | "number" | "select" | "toggle";
  min?: number;
  max?: number;
  step?: number;
  initial: Value;
  neutral?: Value;
  options?: readonly { id: string; label: string }[];
};
/** Add properties once here. Editors, applicability, fine locks and validation consume this registry. */
export const PROPERTIES: Property[] = [
  { id: "color", label: "Color", kind: "color", initial: "#60ddec" },
  {
    id: "brightness",
    label: "Brightness",
    kind: "number",
    min: 0,
    max: 3,
    step: 0.05,
    initial: 1,
    neutral: 1,
  },
  {
    id: "opacity",
    label: "Opacity",
    kind: "number",
    min: 0,
    max: 1,
    step: 0.05,
    initial: 1,
    neutral: 1,
  },
  { id: "glow", label: "Glow", kind: "number", min: 0, max: 2, step: 0.05, initial: 0, neutral: 0 },
  { id: "blur", label: "Blur", kind: "number", min: 0, max: 20, step: 1, initial: 10, neutral: 0 },
  {
    id: "effect",
    label: "Animation",
    kind: "select",
    initial: "stars",
    neutral: "off",
    options: EFFECT_KINDS.map((id) => ({
      id,
      label:
        id === "starfield"
          ? "🌌✧"
          : id === "electric-text"
            ? "Lightning text / icons"
            : id === "falling-stars"
              ? "Falling stars / snow"
              : id === "lightning"
                ? "Lightning outlines"
                : id[0].toUpperCase() + id.slice(1),
    })),
  },
  {
    id: "speed",
    label: "Animation speed",
    kind: "number",
    min: 0,
    max: 1,
    step: 0.05,
    initial: 0.25,
    neutral: 0,
  },
  {
    id: "intensity",
    label: "Effect intensity",
    kind: "number",
    min: 0,
    max: 1,
    step: 0.05,
    initial: 0.35,
    neutral: 0,
  },
  {
    id: "density",
    label: "Density",
    kind: "number",
    min: 0,
    max: 4,
    step: 0.05,
    initial: 0.5,
    neutral: 0,
  },
  {
    id: "size",
    label: "Star size",
    kind: "number",
    min: 0.1,
    max: 3,
    step: 0.05,
    initial: 1,
    neutral: 1,
  },
  {
    id: "length",
    label: "Lightning length",
    kind: "number",
    min: 0.05,
    max: 1,
    step: 0.05,
    initial: 0.35,
  },
  {
    id: "font",
    label: "Font",
    kind: "select",
    initial: "system",
    neutral: "system",
    options: FONT_OPTIONS,
  },
];
const numeric = (
  id: string,
  label: string,
  min: number,
  max: number,
  step: number,
  initial: number,
): Property => ({ id, label, kind: "number", min, max, step, initial, neutral: initial });
PROPERTIES.push(
  numeric("contourWidth", "Contour thickness", 0, 12, 0.5, 1),
  {
    id: "contourStyle",
    label: "Contour style",
    kind: "select",
    initial: "solid",
    neutral: "solid",
    options: ["solid", "dashed", "dotted"].map((id) => ({ id, label: id })),
  },
  numeric("rounding", "Corner rounding", 0, 48, 1, 6),
  numeric("textSize", "UI text size", 8, 48, 1, 12),
  numeric("textWeight", "UI text weight", 100, 900, 100, 400),
  numeric("textSpacing", "UI text spacing", -1, 6, 0.1, 0),
  { id: "gradient", label: "Gradient fill", kind: "toggle", initial: false, neutral: false },
  { id: "gradientColor", label: "Gradient second color", kind: "color", initial: "#7546cf" },
  numeric("gradientAngle", "Gradient direction", 0, 360, 1, 135),
  numeric("shadowStrength", "Shadow strength", 0, 1, 0.05, 0),
  numeric("shadowSpread", "Shadow spread", 0, 32, 1, 0),
  numeric("shadowX", "Shadow horizontal offset", -32, 32, 1, 0),
  numeric("shadowY", "Shadow vertical offset", -32, 32, 1, 4),
  numeric("saturation", "UI icon saturation", 0, 2, 0.05, 1),
);
// Effect controls describe a target's presentation, never another target branch.
export const EFFECT_PROPERTIES = [
  "effect",
  "speed",
  "intensity",
  "density",
  "size",
  "length",
  "effectColor",
  "effectBrightness",
  "effectOpacity",
  "effectGlow",
];
for (const [id, label, source] of [
  ["effectColor", "Animation color", "color"],
  ["effectBrightness", "Animation brightness", "brightness"],
  ["effectOpacity", "Animation opacity", "opacity"],
  ["effectGlow", "Animation glow", "glow"],
] as const) {
  const original = PROPERTIES.find((p) => p.id === source)!;
  PROPERTIES.push({ ...original, id, label });
}
export const propertyFor = (id: string) => PROPERTIES.find((p) => p.id === id);
export function validateProperty(id: string, value: unknown): Value | undefined {
  const p = propertyFor(id);
  if (!p) return;
  if (p.kind === "toggle") return typeof value === "boolean" ? value : undefined;
  if (p.kind === "color")
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
  if (p.kind === "number")
    return typeof value === "number" && Number.isFinite(value)
      ? Math.max(p.min!, Math.min(p.max!, value))
      : undefined;
  if (id === "font") return typeof value === "string" ? normalizeFont(value) : undefined;
  return p.options?.some((o) => o.id === value) ? (value as string) : undefined;
}
export const loadController = (value: unknown) =>
  migrateFieldBranches(migrateEffects(
    normalizeController(value, validateProperty),
    LEGACY_EFFECT_TARGETS,
    EFFECT_PROPERTIES,
  ), LEGACY_FIELD_BRANCHES);
export type Binding = {
  selector?: string;
  css?: string;
  legacy?: string;
  text?: boolean;
  fallback?: string;
  animation?: {
    kind: "text" | "icons" | "surface";
    source?: AnimationTarget;
    glyphsOnly?: boolean;
    selector?: string;
    priority?: number;
  };
};
export type RegisteredTarget = Target & { binding?: Binding; defaults?: Values; hidden?: boolean; aggregate?: boolean };
export const SELECTOR_FEEDBACK = {
  included: { label: "Included", color: "#66efab" },
  excluded: { label: "Excluded", color: "#ff6c73" },
  boundary: { label: "Boundary", color: "#60ddec" },
} as const;
/** Inline artwork has its own ink; it never inherits a text target's color. */
export const UI_INLINE_ICON_SELECTOR = 'button svg,[role="button"] svg,button[data-ui-visual-kind="icon"]:not(.function-icon):not([data-ui-native-icon]):not(:has(svg,img,.appearance-icon-mask))';
const surface = ["color", "brightness", "opacity", "glow"],
  text = [...surface, "font"];
const entries: RegisteredTarget[] = [];
const branch = (id: string, parent: string | undefined, label: string) =>
  entries.push({ id, parent, label });
const part = (
  id: string,
  parent: string,
  label: string,
  binding: Binding,
  properties = surface,
) => {
  if (binding.selector) {
    const kind = binding.text ? "text" : "surface";
    const source: AnimationTarget | undefined = binding.text
      ? id === "text.ui.buttons"
        ? "buttons"
        : id === "text.ui.contents" || id === "text.ui.labels" || id === "text.ui.placeholders"
          ? "fields"
          : "windows"
      : binding.css === "border-color"
        ? id.startsWith("ui.fields.")
          ? "fields"
          : id.startsWith("ui.buttons.")
            ? "buttons"
            : id.startsWith("ui.windows.") || id.startsWith("ui.headers.")
              ? "windows"
              : undefined
        : undefined;
    const priority =
      (
        {
          titles: 50,
          shortcuts: 60,
          headings: 40,
          buttons: 30,
          labels: 20,
          placeholders: 35,
          contents: 30,
        } as Record<string, number>
      )[id.split(".").at(-1)!] ?? 0;
    binding = { ...binding, animation: binding.animation ?? { kind, source, glyphsOnly: !!binding.text, priority } };
  }
  if (binding.selector && binding.css === "border-color")
    properties = [...properties, "contourWidth", "contourStyle"];
  if (binding.selector && binding.css === "background-color")
    properties = [
      ...properties,
      "rounding",
      "gradient",
      "gradientColor",
      "gradientAngle",
      "shadowStrength",
      "shadowSpread",
      "shadowX",
      "shadowY",
    ];
  if (binding.selector && binding.text)
    properties = [...properties, "textSize", "textWeight", "textSpacing"];
  if (id === "symbols.ui") properties = [...properties, "saturation"];
  if (id === "omnium.binders.path") properties = [...properties, "contourWidth"];
  if (binding.animation) properties = [...properties, ...EFFECT_PROPERTIES];
  entries.push({
    id,
    parent,
    label,
    properties: [...new Set(properties)],
    binding,
    effectKinds:
      binding.animation?.kind === "surface"
        ? EFFECT_KINDS.filter((kind) => kind !== "electric-text")
        : binding.animation
          ? EFFECT_KINDS
          : undefined,
  });
};
branch("all", undefined, "Everything");
branch("ui", "all", "Windows / frames / controls");
branch("ui.windows", "ui", "Window and frame surfaces");
part(
  "ui.windows.background",
  "ui.windows",
  "Background",
  {
    selector: ".floating-window-content,.ui-panel-body,.ui-contour,.toolbar,.sidebar,.ui-inline-group > .property-node-contents,.ui-structured-frame > .ui-frame-root",
    css: "background-color",
    legacy: "windowBackground",
  },
  [...surface, "blur"],
);
part("ui.windows.contour", "ui.windows", "Outer contour", {
  selector: ".floating-window-content,.ui-panel-body,.ui-contour,.toolbar,.sidebar,.ui-inline-group > .property-node-contents,.ui-structured-frame > .ui-frame-root",
  css: "border-color",
  legacy: "accent",
});
part("ui.windows.dividers", "ui.windows", "Dividers / separators", {
  selector: ".floating-window-content section,.settings-category,.outline-row,.ui-dock-divider",
  css: "border-color",
  legacy: "accent",
});
branch("ui.headers", "ui", "Frame handles / headers");
part("ui.headers.background", "ui.headers", "Background", {
  selector: ".ui-frame-handle,.entity-menu-header,[data-ui-inline-handle],.ui-dock-tab-strip",
  css: "background-color",
  legacy: "headerBackground",
});
part("ui.headers.contour", "ui.headers", "Contour", {
  selector: ".ui-frame-handle,.entity-menu-header,[data-ui-inline-handle],.ui-dock-tab-strip",
  css: "border-color",
  legacy: "accent",
});
branch("ui.contents", "ui", "Contents");
branch("ui.fields", "ui.contents", "Fields");
for (const [id, label, selector] of [
  ["single", "Single-line fields", 'input[type="text"],input:not([type])'],
  ["multi", "Multiline fields", "textarea"],
  ["search", "Search fields", 'input[type="search"]'],
  ["number", "Numeric fields", 'input[type="number"]'],
  ["select", "Dropdowns / selectors", "select"],
] as const) {
  branch(`ui.fields.${id}`, "ui.fields", label);
  entries.at(-1)!.hidden = true;
  part(`ui.fields.${id}.background`, "ui.fields.background", "Background", {
    selector,
    css: "background-color",
    legacy: "fieldBackground",
  });
  entries.at(-1)!.hidden = true;
  part(`ui.fields.${id}.contour`, "ui.fields.contour", "Contour", {
    selector,
    css: "border-color",
    legacy: "accent",
  });
  entries.at(-1)!.hidden = true;
}
// Shared controls operate on the original bindings, retaining saved type-specific
// paint and local refinements without duplicating the visible hierarchy or renderer.
for (const kind of ["background", "contour"] as const) {
  const template = entries.find(target => target.id === `ui.fields.single.${kind}`)!;
  entries.push({ ...template, id: `ui.fields.${kind}`, parent: "ui.fields", hidden: false,
    aggregate: true, binding: { ...template.binding,
      selector: entries.filter(target => target.parent === `ui.fields.${kind}`)
        .map(target => target.binding?.selector).filter(Boolean).join(","),
    } });
}
branch("ui.toggles", "ui.fields", "Checkboxes / radio buttons / switches");
part("ui.toggles.indicator", "ui.toggles", "Selection indicator", {
  selector: 'input[type="checkbox"],input[type="radio"]',
  css: "accent-color",
  legacy: "accent",
});
branch("ui.sliders", "ui.fields", "Sliders");
part("ui.sliders.fill", "ui.sliders", "Filled track / thumb", {
  selector: 'input[type="range"],progress,meter',
  css: "accent-color",
  legacy: "accent",
});
part("ui.swatches", "ui.fields", "Color swatch contours", {
  selector: 'input[type="color"]',
  css: "border-color",
  legacy: "accent",
});
branch("ui.buttons", "ui.contents", "Buttons / action controls");
part("ui.buttons.background", "ui.buttons", "Background", {
  selector: "button:not(.appearance-target):not(.appearance-lock)",
  css: "background-color",
  legacy: "controlBackground",
});
part("ui.buttons.contour", "ui.buttons", "Contour", {
  selector: "button",
  css: "border-color",
  legacy: "accent",
});
branch("ui.lists", "ui.contents", "Lists / trees / search results");
part("ui.lists.background", "ui.lists", "Area background", {
  selector: ".entity-results,.icon-results,.ui-frame-search-results,.categorized-library",
  css: "background-color",
  legacy: "fieldBackground",
});
part("ui.lists.selection", "ui.lists", "Selected item", {
  selector: '.outline-name.active,[role="option"][aria-selected="true"]',
  css: "background-color",
  legacy: "accent",
});
branch("ui.scrollbars", "ui.contents", "Scrollbars");
part("ui.scrollbars.thumb", "ui.scrollbars", "Thumb", { legacy: "accent" }, [
  "color",
  "brightness",
  "opacity",
]);
part("ui.scrollbars.track", "ui.scrollbars", "Track", { legacy: "background" }, [
  "color",
  "brightness",
  "opacity",
]);
branch("ui.popups", "ui", "Menus / tooltips / notices");
part("ui.popups.background", "ui.popups", "Background", {
  selector:
    ".ui-frame-search-popup,.spatial-menu,.ui-background-menu,.ui-shortcut-notice,.node-options",
  css: "background-color",
  legacy: "windowBackground",
});
part("ui.popups.contour", "ui.popups", "Contour", {
  selector: ".ui-frame-search-popup,.spatial-menu,.ui-background-menu,.node-options",
  css: "border-color",
  legacy: "accent",
});
branch("ui.guides", "ui", "UI arrangement indicators");
part("ui.guides.fill", "ui.guides", "Selection / docking fill", {
  selector: ".ui-selection-rectangle,.ui-drop-indicator,.menu-empty-slot",
  css: "background-color",
  legacy: "accent",
});
part("ui.guides.contour", "ui.guides", "Selection / snapping contours", {
  selector: ".ui-selection-rectangle,.ui-drop-indicator,.menu-empty-slot,.ui-search-found",
  css: "border-color",
  legacy: "accent",
});
branch("ui.guides.selector", "ui.guides", "Selector feedback");
for (const [tone, defaults] of Object.entries(SELECTOR_FEEDBACK))
  entries.push({
    id: `ui.guides.selector.${tone}`, parent: "ui.guides.selector", label: defaults.label,
    properties: [...surface], defaults: { color: defaults.color, brightness: 1, opacity: 1, glow: 1 },
    // The feedback adapter paints SVG edges, glyph ranges and icons together.
    binding: { selector: `.visual-selection-trace.is-${tone}` },
  });
branch("text", "all", "Text");
branch("text.ui", "text", "UI text");
for (const [id, label, selector] of [
  [
    "titles",
    "Window / frame titles",
    ".ui-frame-handle button,.entity-menu-header strong,.brand strong,[data-ui-inline-handle]",
  ],
  ["headings", "Section / category headings", "h1,h2,h3,legend"],
  ["buttons", "Button labels", 'button:not([data-ui-visual-kind="icon"]):not(.function-icon):not([data-ui-native-icon])'],
  ["labels", "Field labels", "label"],
  ["placeholders", "Placeholder text", "input::placeholder,textarea::placeholder"],
  ["contents", "Field contents", "input,textarea,select"],
  [
    "body",
    "Explanations / status / list text",
    ".workbench,.floating-window,.spatial-menu,.ui-background-menu,.ui-shortcut-notice,.ui-frame-search-popup,.brand span,p,small,dt,dd,li,.save-status,.relationship-list,.ui-frame-search-results",
  ],
  ["shortcuts", "Shortcut labels", ".shortcut-hint,.binding-row"],
] as const)
  part(
    `text.ui.${id}`,
    "text.ui",
    label,
    { selector, css: "color", legacy: "textColor", text: true },
    text,
  );
part(
  "text.nodes",
  "omnium.nodes",
  "Node text · defaults",
  { legacy: "nodeText", animation: { kind: "text", source: "nodes" } },
  text,
);
part(
  "text.binders",
  "omnium.binders",
  "Binder text · defaults",
  { legacy: "binderText", animation: { kind: "text", source: "binders", glyphsOnly: true } },
  text,
);
part("symbols.ui", "ui", "UI icons", {
  selector: UI_INLINE_ICON_SELECTOR,
  css: "color",
  legacy: "accent",
  animation: {
    kind: "icons",
    source: "buttons",
    glyphsOnly: true,
    selector: `button img,.ui-frame-handle img,.appearance-icon-mask,${UI_INLINE_ICON_SELECTOR}`,
  },
});
part("symbols.nodes", "omnium.nodes", "Node visuals · defaults", {
  legacy: "nodes.color",
  animation: { kind: "icons", source: "nodes" },
});
part("symbols.binders", "omnium.binders", "Binder operators · defaults", {
  legacy: "binders.color",
  animation: { kind: "icons", source: "binders", glyphsOnly: true },
});
branch("omnium", "all", "Omnium · defaults");
branch("omnium.nodes", "omnium", "Nodes");
part("omnium.nodes.body", "omnium.nodes", "Sphere / geometric body", {
  legacy: "nodes.color",
  animation: { kind: "surface", source: "nodes" },
});
part("omnium.nodes.background", "omnium.nodes", "Label background", {
  legacy: "background",
  animation: { kind: "surface" },
});
part("omnium.nodes.contour", "omnium.nodes", "Label contour", {
  legacy: "nodes.color",
  animation: { kind: "surface" },
});
branch("omnium.binders", "omnium", "Binders");
part("omnium.binders.path", "omnium.binders", "Connection path", {
  legacy: "binders.color",
  animation: { kind: "surface", source: "binders" },
});
part("omnium.binders.background", "omnium.binders", "Label background", {
  legacy: "background",
  animation: { kind: "surface" },
});
part("omnium.selection", "omnium", "Selection / focus rings", {
  legacy: "nodes.color",
  animation: { kind: "surface" },
});
part(
  "workspace.background",
  "all",
  "Workspace background",
  { legacy: "background", animation: { kind: "surface", source: "background" } },
  ["color", "brightness"],
);
export const TARGETS: readonly RegisteredTarget[] = entries;
const LEGACY_FIELD_BRANCHES = Object.fromEntries(
  ["single", "multi", "search", "number", "select"].map(kind => [
    `ui.fields.${kind}`, [`ui.fields.${kind}.background`, `ui.fields.${kind}.contour`],
  ]),
);
const LEGACY_EFFECT_TARGETS = Object.fromEntries(
  ["windows", "buttons", "fields", "nodes", "binders", "background"].map((source) => [
    `vfx.${source}`,
    TARGETS.filter((t) => t.binding?.animation?.source === source).map((t) => ({
      id: t.id,
      glyphsOnly: t.binding?.animation?.glyphsOnly,
      effectKinds: t.effectKinds,
    })),
  ]),
);
export function controllerTargets(state: Controller): RegisteredTarget[] {
  const targets = [...TARGETS];
  const parents = new Set<string>();
  for (const [id, instance] of Object.entries(state.instances)) {
    const base = TARGETS.find((t) => t.id === instance.base);
    if (!base) continue;
    const parent = `${base.id}.custom`;
    if (!parents.has(parent)) {
      parents.add(parent);
      targets.push({ id: parent, parent: base.id, label: "Individually customized", hidden: base.hidden });
    }
    targets.push({
      id,
      parent,
      label: instance.label,
      properties: base.properties,
      effectKinds: base.effectKinds,
      instance,
      binding: base.binding,
    });
  }
  return targets;
}
export const instanceId = (base: string, owner: string) => `${base}@@${encodeURIComponent(owner)}`;
export const appearanceFonts = (appearance: { font: unknown; controller?: Controller }) => [
  ...new Set([
    normalizeFont(appearance.font),
    ...Object.values(appearance.controller?.values ?? {}).flatMap((v) =>
      typeof v.font === "string" ? [normalizeFont(v.font)] : [],
    ),
  ]),
];
