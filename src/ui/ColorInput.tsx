import { useCancelValueEdit } from "./ActiveContext";
import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "onInput"> & {
  value: string;
  onChange: (value: string) => void;
  onPreview?: (value: string) => void;
};
/** Native input previews stay outside document/history persistence. Native change
 * commits once when the picker is accepted; blur is a fallback for browser pickers. */
export function ColorInput({ value, onChange, onPreview, ...props }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const callbacks = useRef({ onChange, onPreview }); callbacks.current = { onChange, onPreview };
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  const committed = useRef(value), pending = useRef(value), frame = useRef(0);
  useEffect(() => { if (!editing.current) { committed.current = value; pending.current = value; setDraft(value); } }, [value]);
  useEffect(() => {
    const element = input.current!;
    const commit = () => {
      cancelAnimationFrame(frame.current); frame.current = 0;
      const next = editing.current ? pending.current : element.value;
      pending.current = next; setDraft(next);
      const changed = next !== committed.current || editing.current;
      editing.current = false; committed.current = next;
      if (changed) callbacks.current.onChange(next);
    };
    element.addEventListener("change", commit);
    element.addEventListener("blur", commit);
    return () => {
      cancelAnimationFrame(frame.current);
      element.removeEventListener("change", commit); element.removeEventListener("blur", commit);
    };
  }, []);
  useCancelValueEdit(input, () => {
    if (!editing.current) return;
    cancelAnimationFrame(frame.current); frame.current = 0;
    editing.current = false; pending.current = committed.current; setDraft(committed.current);
    input.current!.value = committed.current;
    callbacks.current.onPreview?.(committed.current);
  });
  return <input {...props} ref={input} type="color" value={draft} onChange={() => {}} onInput={event => {
    editing.current = true; pending.current = event.currentTarget.value;
    if (!frame.current) frame.current = requestAnimationFrame(() => {
      frame.current = 0; setDraft(pending.current); callbacks.current.onPreview?.(pending.current);
    });
  }} />;
}
