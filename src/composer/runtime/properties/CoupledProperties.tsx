import { useContextPropertyBindings } from "./contextBindings";
import { useState, useEffect, useRef } from "react";
import { PROPERTY_REGISTRY } from "../appearance/registry";
import { PropertyEditor } from "../appearance/Controls";
import { UISection } from "../ui/UISection";
import { UIField } from "../ui/UIField";
import { preparePropertyChanges, type PropertyChange, type PropertyValue } from "./registry";
export type PropertyBindings = {
  values: Record<string, Record<string, PropertyValue>>;
  limits?: Record<string, Record<string, {min:number;max:number}>>;
  commit: (changes: PropertyChange[]) => void;
  preview?: (changes: PropertyChange[] | null) => void;
};
/** One frame-coalesced preview lifecycle for local fields and generated groups. */
function BoundEditor({bindings,property,consumers,...props}:Omit<Parameters<typeof PropertyEditor>[0],'onPreview'|'onCommit'|'onCancelPreview'>&{bindings:PropertyBindings;consumers:string[]}){
 const latest=useRef(bindings);latest.current=bindings;
 const frame=useRef(0),pending=useRef<PropertyChange[]|null>(null),active=useRef<PropertyBindings|null>(null);
 const cancel=()=>{cancelAnimationFrame(frame.current);frame.current=0;pending.current=null;active.current?.preview?.(null);active.current=null;};
 const cancelRef=useRef(cancel);cancelRef.current=cancel;
 const scope=JSON.stringify([property,consumers]);
 useEffect(()=>()=>cancelRef.current(),[scope]);
 return <PropertyEditor {...props} property={property} onCancelPreview={cancel} onPreview={value=>{
   pending.current=preparePropertyChanges(PROPERTY_REGISTRY,property,value,consumers);
   if(!frame.current)frame.current=requestAnimationFrame(()=>{frame.current=0;active.current??=latest.current;active.current.preview?.(pending.current);});
 }} onCommit={value=>{cancelAnimationFrame(frame.current);frame.current=0;pending.current=null;active.current=null;bindings.commit(preparePropertyChanges(PROPERTY_REGISTRY,property,value,consumers));}}/>;
}
/** Generated categories, one editor per property, and independent consumer targets. */
export function CoupledProperties({ bindings: suppliedBindings, category: requestedCategory, selectedConsumers, scope = "master" }: { bindings: PropertyBindings; category?: string; selectedConsumers?: readonly string[]; scope?: string }) {
  const bindings = useContextPropertyBindings(suppliedBindings);
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const consumers = PROPERTY_REGISTRY.consumers.filter(consumer => consumer.owner !== "appearance" && (consumer.owner === "settings" || !!bindings.values[consumer.id]) && (!selectedConsumers || selectedConsumers.includes(consumer.id)));
  for (const consumer of consumers) for (const property of Object.keys(consumer.channels)) {
    if (consumer.owner === "settings" && bindings.values[consumer.id]?.[consumer.channels[property]] === undefined)
      throw new Error(`Missing property adapter: ${consumer.id}/${property}`);
  }
  return <>{PROPERTY_REGISTRY.categories.filter(category => requestedCategory ? category.id === requestedCategory : category.id !== "visual").map(category => {
    const properties = PROPERTY_REGISTRY.definitions.filter(property => property.category?.id === category.id &&
      consumers.some(consumer => consumer.properties.includes(property.id) && bindings.values[consumer.id]?.[consumer.channels[property.id]] !== undefined));
    if (!properties.length) return null;
    const contents = <>
      {properties.map(property => {
        const targets = consumers.filter(consumer => consumer.properties.includes(property.id) && bindings.values[consumer.id]?.[consumer.channels[property.id]] !== undefined);
        const selected = targets.filter(consumer => !excluded.has(`${property.id}:${consumer.id}`));
        const values = selected.map(consumer => bindings.values[consumer.id][consumer.channels[property.id]]);
        const value = values[0] ?? property.initial;
        const mixed = values.some(item => item !== value);
        const ranges = selected.flatMap(consumer => bindings.limits?.[consumer.id]?.[property.id] ? [bindings.limits[consumer.id][property.id]] : []);
        const limits = ranges.length ? {min:Math.max(...ranges.map(range=>range.min)),max:Math.min(...ranges.map(range=>range.max))} : undefined;
        return <UISection key={property.id} id={`${scope}-property:${property.id}`} title={property.label}>
          {targets.map(consumer => <UIField key={consumer.id} id={`${scope}-target:${property.id}:${consumer.id}`} label={consumer.label} category={category.label}>
            <label><input type="checkbox" checked={!excluded.has(`${property.id}:${consumer.id}`)}
              onChange={() => setExcluded(old => { const next = new Set(old), key = `${property.id}:${consumer.id}`;
                if (next.has(key)) next.delete(key); else next.add(key); return next; })} />{consumer.label}</label>
          </UIField>)}
          <UIField id={`${scope}-setter:${property.id}`} label={property.label} category={category.label}>
            <label>{property.label}{property.unit ? ` (${property.unit})` : ""}{mixed ? " · Mixed" : ""}
              <BoundEditor bindings={bindings} consumers={selected.map(consumer=>consumer.id)} property={property.id} value={value} limits={limits} disabled={!selected.length} choices={property.kind === "select" ? property.options?.filter(option => selected.every(consumer => !consumer.choices[property.id] || consumer.choices[property.id].includes(option.id))).map(option => option.id) : undefined} />
            </label>
          </UIField>
        </UISection>;
      })}
    </>;
    return requestedCategory ? <div key={category.id} className="coupled-category-properties">{contents}</div> : <UISection key={category.id} id={`${scope}-category:${category.id}`} title={category.label} defaultExpanded={!!selectedConsumers}>{contents}</UISection>;
  })}</>;
}

/** Existing local controls use this same setter/editor, retaining their stable action IDs. */
export function CoupledField({ bindings, consumer, property, label }: { bindings: PropertyBindings; consumer: string; property: string; label?: string }) {
  const coupling = PROPERTY_REGISTRY.consumer(consumer)?.channels[property];
  if (!coupling || bindings.values[consumer]?.[coupling] === undefined) throw new Error(`Missing property adapter: ${consumer}/${property}`);
  const definition = PROPERTY_REGISTRY.property(property)!;
  return <label>{label ?? definition.label}<BoundEditor bindings={bindings} consumers={[consumer]} label={label ?? definition.label} property={property} value={bindings.values[consumer][coupling]}
    /></label>;
}
