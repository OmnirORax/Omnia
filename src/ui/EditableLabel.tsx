import { useCancelValueEdit } from "./ActiveContext";
import { useEffect, useRef, useState } from "react";
import { useUITracked } from "./context";
import { nameSymbol } from "./nameSymbols";
import { FEATURE_GESTURES } from "../featureActions";

/** Display names are UI preferences. IDs, ownership and property semantics never change. */
export function useUILabel(id: string, fallback: string) {
  const ui = useUITracked(ui=>[ui.layout.labels?.[id],ui.layout.hideNames]);
  const rename = (value: string) => {
    const name = value.trim().slice(0, 240);
    ui.update((layout) => {
      const labels = { ...layout.labels };
      if (name) labels[id] = name;
      else delete labels[id];
      return { ...layout, labels };
    });
  };
  return [ui.layout.labels?.[id] ?? fallback, rename] as const;
}

export function UINameInput({
  value,
  onRename,
  label = "Name",
  autoFocus = false,
  onDone,
}: {
  value: string;
  onRename: (name: string) => void;
  label?: string;
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false), input = useRef<HTMLInputElement>(null);
  useCancelValueEdit(input, () => { cancelled.current = true; setDraft(value); });
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      ref={input}
      className="ui-name-input"
      aria-label={label}
      value={draft}
      maxLength={240}
      autoFocus={autoFocus}
      onFocus={(event) => {
        cancelled.current = false;
        if (autoFocus) event.currentTarget.select();
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (!cancelled.current && draft.trim() !== value) onRename(draft);
        onDone?.();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape") {
          cancelled.current = true;
          setDraft(value);
        }
        event.currentTarget.blur();
      }}
    />
  );
}

export function EditableLabel({ id, fallback }: { id: string; fallback: string }) {
  const ui = useUITracked(ui=>[ui.layout.labels?.[id],ui.layout.hideNames]);
  const [name, rename] = useUILabel(id, fallback);
  const [editing, setEditing] = useState(false);
  return editing ? (
    <UINameInput value={name} onRename={rename} autoFocus onDone={() => setEditing(false)} />
  ) : (
    <span
      className="ui-editable-label"
      title={ui.layout.hideNames ? name : ""}
      data-ui-name={name}
      data-ui-symbol={nameSymbol(id, fallback)}
      tabIndex={0}
      onDoubleClick={(event) => {
        event.stopPropagation();
        setEditing(true);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key === FEATURE_GESTURES.find(gesture => gesture.id === "ui.rename")!.binding) {
          event.preventDefault();
          event.stopPropagation();
          setEditing(true);
        }
      }}
    >
      {name}
    </span>
  );
}
