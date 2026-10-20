import { EFFECT_KINDS } from "../graph/effects.ts";
import { FONT_OPTIONS, normalizeFont } from "../fonts.ts";
import { type Controller, type Target, type Value, normalizeController } from "./model.ts";
export type Property = {
  id: string;
  label: string;
  kind: "color" | "number" | "select";
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
export const propertyFor = (id: string) => PROPERTIES.find((p) => p.id === id);
export function validateProperty(id: string, value: unknown): Value | undefined {
  const p = propertyFor(id);
  if (!p) return;
  if (p.kind === "color")
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
  if (p.kind === "number")
    return typeof value === "number" && Number.isFinite(value)
      ? Math.max(p.min!, Math.min(p.max!, value))
      : undefined;
  if (id === "font") return typeof value === "string" ? normalizeFont(value) : undefined;
  return p.options?.some((o) => o.id === value) ? (value as string) : undefined;
}
export const loadController = (value: unknown) => normalizeController(value, validateProperty);
export type Binding = {
  selector?: string;
  css?: string;
  legacy?: string;
  text?: boolean;
  fallback?: string;
};
export type RegisteredTarget = Target & { binding?: Binding };
const surface = ["color", "brightness", "opacity", "glow"],
  text = [...surface, "font"];
const entries: RegisteredTarget[] = [];
const branch = (id: string, parent: string | undefined, label: string) =>
  entries.push({ id, parent, label });
const part = (id: string, parent: string, label: string, binding: Binding, properties = surface) =>
  entries.push({ id, parent, label, properties, binding });
branch("all", undefined, "Everything");
branch("ui", "all", "Windows / frames / controls");
branch("ui.windows", "ui", "Window and frame surfaces");
part(
  "ui.windows.background",
  "ui.windows",
  "Background",
  {
    selector: ".floating-window-content,.ui-panel-body,.ui-contour,.toolbar,.sidebar",
    css: "background-color",
    legacy: "windowBackground",
  },
  [...surface, "blur"],
);
part("ui.windows.contour", "ui.windows", "Outer contour", {
  selector: ".floating-window-content,.ui-panel-body,.ui-contour,.toolbar,.sidebar",
  css: "border-color",
  legacy: "accent",
});
part("ui.windows.dividers", "ui.windows", "Dividers / separators", {
  selector: ".floating-window-content section,.settings-category,.outline-row",
  css: "border-color",
  legacy: "accent",
});
branch("ui.headers", "ui", "Frame handles / headers");
part("ui.headers.background", "ui.headers", "Background", {
  selector: ".ui-frame-handle,.entity-menu-header",
  css: "background-color",
  legacy: "headerBackground",
});
part("ui.headers.contour", "ui.headers", "Contour", {
  selector: ".ui-frame-handle,.entity-menu-header",
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
  part(`ui.fields.${id}.background`, `ui.fields.${id}`, "Background", {
    selector,
    css: "background-color",
    legacy: "fieldBackground",
  });
  part(`ui.fields.${id}.contour`, `ui.fields.${id}`, "Contour", {
    selector,
    css: "border-color",
    legacy: "accent",
  });
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
  selector: "button:not(.appearance-target):not(.appearance-plug):not(.appearance-lock)",
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
branch("text", "all", "Text");
branch("text.ui", "text", "UI text");
for (const [id, label, selector] of [
  [
    "titles",
    "Window / frame titles",
    ".ui-frame-handle button,.entity-menu-header strong,.brand strong",
  ],
  ["headings", "Section / category headings", "h1,h2,h3,legend"],
  ["buttons", "Button labels", "button"],
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
part("text.nodes", "text", "Node text · defaults", { legacy: "nodeText" }, text);
part("text.binders", "text", "Binder text · defaults", { legacy: "binderText" }, text);
branch("symbols", "all", "Icons / symbols / visual assets");
part("symbols.ui", "symbols", "UI icons", { legacy: "accent" });
part("symbols.nodes", "symbols", "Node visuals · defaults", { legacy: "nodes.color" });
part("symbols.binders", "symbols", "Binder operators · defaults", { legacy: "binders.color" });
branch("omnium", "all", "Omnium · defaults");
branch("omnium.nodes", "omnium", "Nodes");
part("omnium.nodes.body", "omnium.nodes", "Sphere / geometric body", { legacy: "nodes.color" });
part("omnium.nodes.background", "omnium.nodes", "Label background", { legacy: "background" });
part("omnium.nodes.contour", "omnium.nodes", "Label contour", { legacy: "nodes.color" });
branch("omnium.binders", "omnium", "Binders");
part("omnium.binders.path", "omnium.binders", "Connection path", { legacy: "binders.color" });
part("omnium.binders.background", "omnium.binders", "Label background", { legacy: "background" });
part("omnium.selection", "omnium", "Selection / focus rings", { legacy: "nodes.color" });
branch("workspace", "all", "Workspace environment");
part("workspace.background", "workspace", "Background", { legacy: "background" }, [
  "color",
  "brightness",
]);
branch("vfx", "all", "VFX");
for (const [id, label] of [
  ["windows", "Windows / frames"],
  ["buttons", "Buttons"],
  ["fields", "Fields"],
  ["nodes", "Nodes"],
  ["binders", "Binders / operators"],
  ["background", "Background"],
] as const)
  part(`vfx.${id}`, "vfx", label, { legacy: `vfx.${id}` }, [
    "color",
    "brightness",
    "opacity",
    "glow",
    "effect",
    "speed",
    "intensity",
    "density",
    "size",
    "length",
  ]);
export const TARGETS: readonly RegisteredTarget[] = entries;
export function controllerTargets(state: Controller): RegisteredTarget[] {
  const targets = [...TARGETS];
  const parents = new Set<string>();
  for (const [id, instance] of Object.entries(state.instances)) {
    const base = TARGETS.find((t) => t.id === instance.base);
    if (!base) continue;
    const parent = `${base.id}.custom`;
    if (!parents.has(parent)) {
      parents.add(parent);
      targets.push({ id: parent, parent: base.id, label: "Individually customized" });
    }
    targets.push({
      id,
      parent,
      label: instance.label,
      properties: base.properties,
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
