import { useEffect, useRef, useState } from "react";
import { useAppearance } from "../appearance/Context";
import { applyValue, blocked, connected, type Value } from "../appearance/model";
import { PropertyEditor } from "../appearance/Controls";
import { PropertyTree } from "../appearance/PropertyTree";
import { propertyPath } from "../appearance/propertyTree";

/** Logical consumers edit existing values directly, without inventing DOM part instances. */
export function ConsumerProperties({ consumers, selectedProperty, onSelectProperty }: { consumers: string[]; selectedProperty?: string; onSelectProperty?: (id: string) => void }) {
  const ctx = useAppearance()!;
  const targets = ctx.targets.filter(target => consumers.includes(target.id));
  const available = [...new Set(targets.flatMap(target => target.properties ?? []))];
  const [localProperty, setProperty] = useState(available.includes("effect") ? "effect" : available[0]);
  const property = selectedProperty ?? localProperty;
  const chosen = available.includes(property) ? property : available[0];
  const read = ctx.read;
  const preview = useRef(ctx.preview); preview.current = ctx.preview;
  useEffect(() => () => preview.current(null), []);
  if (!chosen) return null;
  return <div>
    <p>{targets.map(target => target.label).join(" · ")}</p>
    <PropertyTree transient scope="consumer-inspection" initialOpen={propertyPath(chosen)} selected={chosen} available={available}
      editable={available.filter(id => !ctx.safe && targets.some(target => target.properties?.includes(id) && !blocked(ctx.state, ctx.targets, target.id, id, "all") && connected(ctx.state, ctx.targets, target.id, id)))}
      onSelect={id => { ctx.preview(null); setProperty(id); onSelectProperty?.(id); }} renderEditor={id => {
        const applicable = targets.filter(target => target.properties?.includes(id));
        const editable = applicable.filter(target => !blocked(ctx.state, ctx.targets, target.id, id, "all") && connected(ctx.state, ctx.targets, target.id, id));
        const values = applicable.map(target => read(target, id));
        const kinds = [...new Set(applicable.flatMap(target => target.effectKinds ?? []))];
        const change = (value: Value, temporary: boolean) => {
          let next = ctx.state;
          for (const target of editable) next = applyValue(next, ctx.targets, id, value, target.id, false, { readInput: ctx.read });
          if (temporary) ctx.preview(next); else ctx.commit(next);
        };
        return <div className="selection-property-editor">
          <PropertyEditor previewTargets={editable} property={id} label={`Selected ${id}`} value={values[0]} effectKinds={kinds.length ? kinds : undefined}
            disabled={ctx.safe || !editable.length} onPreview={value => change(value, true)} onCommit={value => change(value, false)} />
          <small>{new Set(values).size > 1 ? "Mixed values · " : ""}{editable.length} applicable</small>
        </div>;
      }} />
  </div>;
}
