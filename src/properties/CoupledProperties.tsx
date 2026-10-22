import { useState } from "react";
import { PROPERTY_REGISTRY } from "../appearance/registry";
import { PropertyEditor } from "../appearance/Controls";
import { UISection } from "../ui/UISection";
import { UIField } from "../ui/UIField";
import { preparePropertyChanges, type PropertyChange, type PropertyValue } from "./registry";
export type PropertyBindings = {
  values: Record<string, Record<string, PropertyValue>>;
  commit: (changes: PropertyChange[]) => void;
};
/** Generated categories, one editor per property, and independent consumer targets. */
export function CoupledProperties({ bindings, category: requestedCategory, selectedConsumers, scope = "master" }: { bindings: PropertyBindings; category?: string; selectedConsumers?: readonly string[]; scope?: string }) {
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const consumers = PROPERTY_REGISTRY.consumers.filter(consumer => consumer.owner !== "appearance" && (!selectedConsumers || selectedConsumers.includes(consumer.id)));
  for (const consumer of consumers) for (const property of Object.keys(consumer.channels)) {
    if (bindings.values[consumer.id]?.[consumer.channels[property]] === undefined)
      throw new Error(`Missing property adapter: ${consumer.id}/${property}`);
  }
  return <>{PROPERTY_REGISTRY.categories.filter(category => requestedCategory ? category.id === requestedCategory : category.id !== "visual").map(category => {
    const properties = PROPERTY_REGISTRY.definitions.filter(property => property.category?.id === category.id &&
      consumers.some(consumer => consumer.properties.includes(property.id)));
    if (!properties.length) return null;
    const contents = <>
      {properties.map(property => {
        const targets = consumers.filter(consumer => consumer.properties.includes(property.id));
        const selected = targets.filter(consumer => !excluded.has(`${property.id}:${consumer.id}`));
        const values = selected.map(consumer => bindings.values[consumer.id][consumer.channels[property.id]]);
        const value = values[0] ?? property.initial;
        const mixed = values.some(item => item !== value);
        return <UISection key={property.id} id={`${scope}-property:${property.id}`} title={property.label}>
          {targets.map(consumer => <UIField key={consumer.id} id={`${scope}-target:${property.id}:${consumer.id}`} label={consumer.label} category={category.label}>
            <label><input type="checkbox" checked={!excluded.has(`${property.id}:${consumer.id}`)}
              onChange={() => setExcluded(old => { const next = new Set(old), key = `${property.id}:${consumer.id}`;
                if (next.has(key)) next.delete(key); else next.add(key); return next; })} />{consumer.label}</label>
          </UIField>)}
          <UIField id={`${scope}-setter:${property.id}`} label={property.label} category={category.label}>
            <label>{property.label}{property.unit ? ` (${property.unit})` : ""}{mixed ? " · Mixed" : ""}
              <PropertyEditor property={property.id} value={value} disabled={!selected.length} choices={property.kind === "select" ? property.options?.filter(option => selected.every(consumer => !consumer.choices[property.id] || consumer.choices[property.id].includes(option.id))).map(option => option.id) : undefined} onPreview={() => {}}
                onCommit={value => bindings.commit(preparePropertyChanges(PROPERTY_REGISTRY, property.id, value, selected.map(consumer => consumer.id)))} />
            </label>
          </UIField>
        </UISection>;
      })}
    </>;
    return requestedCategory ? <div key={category.id} className="coupled-category-properties">{contents}</div> : <UISection key={category.id} id={`${scope}-category:${category.id}`} title={category.label} defaultExpanded={!!selectedConsumers}>{contents}</UISection>;
  })}</>;
}

/** Existing local controls use this same setter/editor, retaining their stable action IDs. */
export function CoupledField({ bindings, consumer, property }: { bindings: PropertyBindings; consumer: string; property: string }) {
  const coupling = PROPERTY_REGISTRY.consumer(consumer)?.channels[property];
  if (!coupling || bindings.values[consumer]?.[coupling] === undefined) throw new Error(`Missing property adapter: ${consumer}/${property}`);
  const definition = PROPERTY_REGISTRY.property(property)!;
  return <label>{definition.label}<PropertyEditor property={property} value={bindings.values[consumer][coupling]}
    onPreview={() => {}} onCommit={value => bindings.commit(preparePropertyChanges(PROPERTY_REGISTRY, property, value, [consumer]))} /></label>;
}
