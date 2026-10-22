import { useEffect, useMemo, useRef, useState } from "react";
import { useAppearance } from "../appearance/Context";
import { applyValue, blocked, connected, type Value } from "../appearance/model";
import { createValueResolver } from "../appearance/resolve";
import { PropertyEditor } from "../appearance/Controls";
import { PropertyTree } from "../appearance/PropertyTree";
import { propertyPath } from "../appearance/propertyTree";

/** Logical consumers edit existing values directly, without inventing DOM part instances. */
export function ConsumerProperties({ consumers }: { consumers: string[] }) {
  const ctx = useAppearance()!;
  const targets = ctx.targets.filter(target => consumers.includes(target.id));
  const available = [...new Set(targets.flatMap(target => target.properties ?? []))];
  const [property, setProperty] = useState(available.includes("effect") ? "effect" : available[0]);
  const chosen = available.includes(property) ? property : available[0];
  const read = useMemo(() => createValueResolver(ctx.base, ctx.state, ctx.targets), [ctx.base, ctx.state, ctx.targets]);
  const preview = useRef(ctx.preview); preview.current = ctx.preview;
  useEffect(() => () => preview.current(null), []);
  if (!chosen) return null;
  return <div>
    <p>{targets.map(target => target.label).join(" · ")}</p>
    <PropertyTree transient scope="consumer-inspection" initialOpen={propertyPath(chosen)} selected={chosen} available={available}
      onSelect={id => { ctx.preview(null); setProperty(id); }} renderEditor={id => {
        const applicable = targets.filter(target => target.properties?.includes(id));
        const editable = applicable.filter(target => !blocked(ctx.state, ctx.targets, target.id, id, "all") && connected(ctx.state, ctx.targets, target.id, id));
        const values = applicable.map(target => read(target, id));
        const kinds = [...new Set(applicable.flatMap(target => target.effectKinds ?? []))];
        const change = (value: Value, temporary: boolean) => {
          let next = ctx.state;
          for (const target of editable) next = applyValue(next, ctx.targets, id, value, target.id);
          if (temporary) ctx.preview(next); else ctx.commit(next);
        };
        return <div className="selection-property-editor">
          <PropertyEditor property={id} label={`Selected ${id}`} value={values[0]} effectKinds={kinds.length ? kinds : undefined}
            disabled={ctx.safe || !editable.length} onPreview={value => change(value, true)} onCommit={value => change(value, false)} />
          <small>{new Set(values).size > 1 ? "Mixed values · " : ""}{editable.length} applicable</small>
        </div>;
      }} />
  </div>;
}
