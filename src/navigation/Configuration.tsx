import { cursorPosition } from "../ui/cursorPosition";
import { useEffect, useRef, useState } from "react";
import { PropertyEditor } from "../appearance/Controls";
import { PROPERTY_REGISTRY } from "../appearance/registry";
import { preparePropertyChanges } from "../properties/registry";
import type { PropertyBindings } from "../properties/CoupledProperties";
import { useConfigurationInteraction } from "../ui/ConfigurationInteraction";
import { MODES, NAVIGATION_ID, NAV_DEFAULTS, NAV_KEYS, type NavigationOptions } from "./options";
export function NavigationConfiguration({ bindings, apply, preview }: { bindings: PropertyBindings; apply: (options: NavigationOptions) => void; preview: (options: NavigationOptions | null, point: { x: number; y: number }) => string }) {
  const point = useRef(cursorPosition());
  const [options, setOptions] = useState<NavigationOptions>(() => Object.fromEntries(Object.entries(NAV_DEFAULTS).map(([key, value]) => [key, bindings.values[NAVIGATION_ID]?.[NAV_KEYS[key as keyof NavigationOptions]] ?? value])) as NavigationOptions);
  const current = useRef(options); current.current = options;
  const [summary, setSummary] = useState("");
  const select = (index: number) => { const next = { ...current.current, mode: MODES[index]?.id ?? "orbit" }; current.current = next; setOptions(next); };
  const change = (key: keyof NavigationOptions, value: string | number | boolean) => { const next = { ...current.current, [key]: value }; current.current = next; setOptions(next); };
  const save = (next: NavigationOptions) => bindings.commit(Object.entries(next).flatMap(([key, value]) => preparePropertyChanges(PROPERTY_REGISTRY, NAV_KEYS[key as keyof NavigationOptions], value, [NAVIGATION_ID])));
  useConfigurationInteraction({ cycle: () => select((MODES.findIndex(mode => mode.id === current.current.mode) + 1) % MODES.length), select,
    apply: () => apply(current.current), lock: () => save(current.current), reset: () => { select(0); bindings.commit(preparePropertyChanges(PROPERTY_REGISTRY, NAV_KEYS.mode, "orbit", [NAVIGATION_ID])); },
  });
  useEffect(() => { setSummary(preview(options, point.current)); return () => { preview(null, point.current); }; }, [options]);
  const camera = ["orbit", "look", "walk", "pan"].includes(options.mode);
  const fields: (keyof NavigationOptions)[] = [...(options.mode === "orbit" || options.mode === "layout" ? ["pivot" as const] : []), ...(!camera ? ["target" as const, "descendants" as const] : []), "axis", ...(camera && options.mode !== "pan" && options.axis === "free" ? ["upright" as const] : []), "speed"];
  return <div className="world-navigation-configuration">
    <div className="configuration-options" role="group" aria-label="World navigation mode" onWheel={event => { event.preventDefault(); select((MODES.findIndex(mode => mode.id === current.current.mode) + (event.deltaY > 0 ? 1 : MODES.length - 1)) % MODES.length); }}>
      {MODES.map((mode, index) => <button key={mode.id} data-configuration-option={index} aria-pressed={options.mode === mode.id} title={mode.description} onPointerEnter={() => setSummary(preview({ ...current.current, mode: mode.id }, point.current))} onPointerLeave={() => setSummary(preview(current.current, point.current))}>{mode.label}</button>)}
    </div>
    <small>{MODES.find(mode => mode.id === options.mode)?.description}</small>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{fields.map(key => <label key={key} data-configuration-lock>{PROPERTY_REGISTRY.property(NAV_KEYS[key])?.label}
      <PropertyEditor property={NAV_KEYS[key]} value={options[key]} onPreview={value => change(key, value)} onCommit={value => change(key, value)} />
    </label>)}</div>
    <small role="status">{summary}</small>
    <small title="Release Shift to arm one drag. Right-click an option to apply and lock its future default; left-click resets to Orbit.">Release Shift → next drag · right-click → lock</small>
  </div>;
}
