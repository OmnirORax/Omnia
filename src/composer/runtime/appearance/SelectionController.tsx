import { SelectionPreviewToggle } from "./VisualSelector";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppearance } from "./Context";
import { PropertyEditor } from "./Controls";
import { PropertyTree } from "./PropertyTree";
import { applySelectedValue, selectedPartPolicy, resetSelectedParts, selectedPartTarget, type SelectedPart } from "./selectionCoupling";
import type { Value } from "./model";

/** The main controller and contextual popup share this exact selected-part editor. */
export function SelectedProperties({ parts, scope = "selection", selectedProperty, onSelectProperty }: { parts: SelectedPart[]; scope?: string; selectedProperty?: string; onSelectProperty?: (id: string) => void }) {
  const ctx = useAppearance()!;
  const preview = useRef(ctx.preview); preview.current = ctx.preview;
  useEffect(() => () => preview.current(null), []);
  const [localProperty, setProperty] = useState("color");
  const property = selectedProperty ?? localProperty;
  const editablePart = useMemo(() => selectedPartPolicy(ctx.state), [ctx.state]);
  const read = ctx.read;
  const targets = parts.map(selectedPartTarget);
  const available = [...new Set(targets.flatMap(target => target.properties ?? []))];
  const chosenProperty = available.includes(property) ? property : available[0];
  const change = (id: string, value: Value, temporary: boolean) => {
    const next = applySelectedValue(ctx.state, parts, id, value, { readInput: ctx.read });
    if (temporary) ctx.preview(next); else ctx.commit(next);
  };
  return chosenProperty ? <PropertyTree transient scope={scope} selected={chosenProperty} available={available}
      editable={available.filter(id => !ctx.safe && parts.some(part => editablePart(part, id)))}
      onSelect={id => { ctx.preview(null); setProperty(id); onSelectProperty?.(id); }} renderEditor={id => {
        const applicable = targets.filter(target => target.properties?.includes(id));
        const editable = parts.filter(part => editablePart(part, id));
        const values = applicable.map(target => read(target, id));
        const kinds = [...new Set(applicable.flatMap(target => target.effectKinds ?? []))];
        const mixed = new Set(values).size > 1;
        return <div className="selection-property-editor">
          <PropertyEditor previewTargets={editable.map(selectedPartTarget)} property={id} label={`Selected ${id}`} value={values[0]} effectKinds={kinds.length ? kinds : undefined}
            disabled={ctx.safe || !editable.length} onPreview={value => change(id, value, true)} onCommit={value => change(id, value, false)} />
          <small>{mixed ? "Mixed values · " : ""}{editable.length} applicable{applicable.length > editable.length ? ` · ${applicable.length - editable.length} locked or bypassed` : ""}</small>
        </div>;
      }} /> : <p>Include visual parts to edit their appearance.</p>;
}

/** Another entry to the shared controller and editor, never another property pool. */
export function SelectionController({ parts, position, onClose, onResume }: {
  parts: SelectedPart[]; position: { x: number; y: number }; onClose: () => void; onResume: () => void;
}) {
  const ctx = useAppearance()!;
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
  const top = Math.max(8, Math.min(position.y, innerHeight - 420));
  return <div ref={root} data-visual-selector className="visual-selection-controller" role="dialog" aria-label="Selected appearance" tabIndex={-1}
    style={{ left: Math.max(8, Math.min(position.x, innerWidth - 440)), top, maxHeight: Math.max(0, innerHeight - top - 8) }}
    onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}>
    <header><strong>Selected appearance</strong><button type="button" aria-label="Close selected appearance" onClick={onClose}>×</button></header>
    <SelectionPreviewToggle />
    <p>{parts.length} selected visual parts</p>
    <SelectedProperties parts={parts} />
    <footer><button type="button" onClick={() => {
      ctx.preview(null);
      const next = resetSelectedParts(ctx.state, parts);
      if (next !== ctx.state) ctx.commit(next);
    }}>Use inherited appearance</button><button type="button" onClick={onResume}>Continue selecting</button></footer>
  </div>;
}
