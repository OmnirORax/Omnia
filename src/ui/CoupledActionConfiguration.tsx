import { useRef, useState } from "react";
import { PROPERTY_REGISTRY } from "../appearance/registry";
import { PropertyEditor } from "../appearance/Controls";
import { preparePropertyChanges, type PropertyChange, type PropertyValue } from "../properties/registry";
import { withFunctionInputs } from "../properties/runtimeInputs";
import type { PropertyBindings } from "../properties/CoupledProperties";
import { useConfigurationInteraction } from "./ConfigurationInteraction";

/** Generic input drafts use the existing coupling/setter contract. Only locking
 * writes defaults; invoking a temporary choice overlays that one synchronous call. */
export function CoupledActionConfiguration({ id, bindings }: { id: string; bindings: PropertyBindings }) {
  const fields = PROPERTY_REGISTRY.consumers.filter(consumer => consumer.id === id || consumer.controls?.includes(id))
    .flatMap(consumer => consumer.properties.map(property => ({ consumer, definition: PROPERTY_REGISTRY.property(property)!, property })))
    .filter(field => bindings.values[field.consumer.id]?.[field.consumer.channels[field.property]] !== undefined);
  const primary = fields.find(field => field.definition.unit === "ordinal") ?? fields.find(field => field.definition.kind === "select") ?? fields.find(field => field.definition.kind !== "color");
  const draft = useRef(new Map<string, PropertyChange>()), [, redraw] = useState(0);
  const fieldKey = (consumer: string, property: string) => `${consumer}:${property}`;
  const valueOf = (field: typeof fields[number]) => draft.current.get(fieldKey(field.consumer.id, field.consumer.channels[field.property]))?.value ?? bindings.values[field.consumer.id][field.consumer.channels[field.property]];
  const choices = primary?.definition.kind === "select" ? primary.definition.options!.filter(option => !primary.consumer.choices[primary.consumer.channels[primary.property]] || primary.consumer.choices[primary.consumer.channels[primary.property]].includes(option.id)) : undefined;
  const count = !primary ? 0 : primary.definition.kind === "toggle" ? 2 : choices ? choices.length : primary.definition.kind === "number"
    ? Math.floor((primary.definition.max! - primary.definition.min!) / primary.definition.step! + .000001) + 1 : 0;
  const option = (index: number): PropertyValue => choices ? choices[index].id : primary!.definition.kind === "toggle" ? !!index
    : Number((primary!.definition.min! + index * primary!.definition.step!).toPrecision(12));
  const indexOf = () => !primary ? 0 : choices ? Math.max(0, choices.findIndex(choice => choice.id === valueOf(primary))) : primary.definition.kind === "toggle" ? Number(!!valueOf(primary))
    : Math.round((Number(valueOf(primary)) - primary.definition.min!) / primary.definition.step!);
  const change = (field: typeof fields[number], value: PropertyValue) => {
    for (const next of preparePropertyChanges(PROPERTY_REGISTRY, field.property, value, [field.consumer.id])) draft.current.set(fieldKey(next.consumer, next.property), next);
    redraw(version => version + 1);
  };
  const select = (index: number) => { if (primary && count) change(primary, option(Math.max(0, Math.min(count - 1, index)))); };
  const invoke = () => withFunctionInputs([...draft.current.values()], () => window.dispatchEvent(new CustomEvent("omnium:invoke-button", { detail: `button:${id}` })));
  useConfigurationInteraction({
    cycle: () => { if (count) select((indexOf() + 1) % count); }, select, apply: invoke,
    lock: () => bindings.commit([...draft.current.values()]),
    reset: () => {
      if (!primary || !count) return; select(0);
      bindings.commit(preparePropertyChanges(PROPERTY_REGISTRY, primary.property, option(0), [primary.consumer.id]));
    },
  });
  const buttons = primary && count > 0 && count <= 20 && (choices || primary.definition.kind === "toggle" || primary.definition.unit === "ordinal");
  return <>{fields.map(field => field === primary && buttons ? <div key={fieldKey(field.consumer.id, field.property)} className="configuration-options" role="group" aria-label={field.definition.label}>
    {Array.from({ length: count }, (_, index) => <button key={index} data-configuration-option={index} aria-pressed={indexOf() === index} title="Right-click to apply and lock; left-click resets to priority 1">
      {choices?.[index].label ?? (field.definition.kind === "toggle" ? index ? "On" : "Off" : String(option(index)))}
    </button>)}
  </div> : <label data-configuration-lock key={fieldKey(field.consumer.id, field.property)}>{field.definition.label}
    <PropertyEditor property={field.property} value={valueOf(field)} onPreview={value => change(field, value)} onCommit={value => change(field, value)} />
  </label>)}</>;
}
