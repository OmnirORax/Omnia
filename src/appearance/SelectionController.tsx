import { useEffect, useMemo, useRef, useState } from "react";
import { useAppearance } from "./Context";
import { PropertyEditor } from "./Controls";
import { PropertyTree } from "./PropertyTree";
import { createValueResolver } from "./resolve";
import { applySelectedValue, selectedPartPolicy, resetSelectedParts, selectedPartTarget, type SelectedPart } from "./selectionCoupling";
import type { Value } from "./model";

/** Another entry to the shared controller and editor, never another property pool. */
export function SelectionController({ parts, position, onClose, onResume }: {
  parts: SelectedPart[]; position: { x: number; y: number }; onClose: () => void; onResume: () => void;
}) {
  const ctx = useAppearance()!;
  const [property, setProperty] = useState("color");
  const editablePart = useMemo(() => selectedPartPolicy(ctx.state), [ctx.state]);
  const read = useMemo(() => createValueResolver(ctx.base, ctx.state, ctx.targets), [ctx.base, ctx.state, ctx.targets]);
  const root = useRef<HTMLDivElement>(null);
  const preview = useRef(ctx.preview); preview.current = ctx.preview;
  useEffect(() => {
    const previous = document.activeElement;
    root.current?.focus();
    return () => {
      preview.current(null);
      if (previous instanceof HTMLElement && previous.isConnected && root.current?.contains(document.activeElement)) previous.focus();
    };
  }, []);
  const targets = parts.map(selectedPartTarget);
  const available = [...new Set(targets.flatMap(target => target.properties ?? []))];
  const chosenProperty = available.includes(property) ? property : available[0];
  const top = Math.max(8, Math.min(position.y, innerHeight - 420));
  const change = (id: string, value: Value, temporary: boolean) => {
    const next = applySelectedValue(ctx.state, parts, id, value);
    if (temporary) ctx.preview(next); else ctx.commit(next);
  };
  return <div ref={root} data-visual-selector className="visual-selection-controller" role="dialog" aria-label="Selected appearance" tabIndex={-1}
    style={{ left: Math.max(8, Math.min(position.x, innerWidth - 440)), top, maxHeight: Math.max(0, innerHeight - top - 8) }}
    onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}>
    <header><strong>Selected appearance</strong><button type="button" aria-label="Close selected appearance" onClick={onClose}>×</button></header>
    <p>{parts.length} selected visual parts</p>
    {chosenProperty ? <PropertyTree transient scope="selection" selected={chosenProperty} available={available}
      onSelect={id => { ctx.preview(null); setProperty(id); }} renderEditor={id => {
        const applicable = targets.filter(target => target.properties?.includes(id));
        const editable = parts.filter(part => editablePart(part, id));
        const values = applicable.map(target => read(target, id));
        const kinds = [...new Set(applicable.flatMap(target => target.effectKinds ?? []))];
        const mixed = new Set(values).size > 1;
        return <div className="selection-property-editor">
          <PropertyEditor property={id} label={`Selected ${id}`} value={values[0]} effectKinds={kinds.length ? kinds : undefined}
            disabled={ctx.safe || !editable.length} onPreview={value => change(id, value, true)} onCommit={value => change(id, value, false)} />
          <small>{mixed ? "Mixed values · " : ""}{editable.length} applicable{applicable.length > editable.length ? ` · ${applicable.length - editable.length} locked or bypassed` : ""}</small>
        </div>;
      }} /> : <p>Include visual parts to edit their appearance.</p>}
    <footer><button type="button" onClick={() => {
      ctx.preview(null);
      const next = resetSelectedParts(ctx.state, parts);
      if (next !== ctx.state) ctx.commit(next);
    }}>Use inherited appearance</button><button type="button" onClick={onResume}>Continue selecting</button></footer>
  </div>;
}
