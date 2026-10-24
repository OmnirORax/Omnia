import { useRef, useState } from "react";
import { PROPERTY_REGISTRY } from "../appearance/registry";
import { useConfigurationInteraction } from "../ui/ConfigurationInteraction";
import { selectPropertyValues, type PropertySnapshot } from "./clipboard";

/** Snapshot once when opened; choosing fields neither edits the source nor
 * creates target instances. The shared MC owns opening/release/cancellation. */
export function CopyPropertiesConfiguration({ read, onCopy }: { read: () => PropertySnapshot; onCopy: (snapshot: PropertySnapshot) => void }) {
  const [snapshot] = useState(read);
  const available = Object.keys(snapshot.values);
  const [selected, setSelected] = useState(() => new Set(available));
  const choice = useRef(selected);
  const select = (next: Set<string>) => { choice.current = next; setSelected(next); };
  const apply = () => { if (choice.current.size) onCopy(selectPropertyValues(snapshot, choice.current)); };
  const session = useConfigurationInteraction({
    cycle: () => select(choice.current.size === available.length ? new Set() : new Set(available)),
    apply, reset: () => select(new Set(available)),
  });
  return <div className="copy-property-picker">
    <div className="copy-property-actions">
      <button type="button" onClick={() => select(new Set(available))}>All</button>
      <button type="button" onClick={() => select(new Set())}>None</button>
      <button type="button" disabled={!selected.size} data-configuration-lock onClick={() => { apply(); session?.close(); }}>Copy {selected.size}</button>
    </div>
    <div className="copy-property-choices" role="group" aria-label="Properties to copy">
      {[...available, ...snapshot.mixed].map(property => {
        const mixed = snapshot.mixed.includes(property);
        return <label key={property} title={mixed ? "Mixed source values; choose a narrower source to copy this property." : PROPERTY_REGISTRY.property(property)?.label}>
          <input type="checkbox" checked={selected.has(property)} disabled={mixed} onChange={event => {
            const next = new Set(choice.current); if (event.currentTarget.checked) next.add(property); else next.delete(property); select(next);
          }} />
          <span>{PROPERTY_REGISTRY.property(property)?.label ?? property}{mixed ? " · Mixed" : ""}</span>
        </label>;
      })}
    </div>
  </div>;
}
