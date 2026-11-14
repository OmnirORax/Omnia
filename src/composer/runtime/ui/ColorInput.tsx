import {openColorPicker,closeColorPicker} from '../../../ui/colorPicker.ts';
import { useCancelValueEdit } from "./ActiveContext";
import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "onInput"> & {
  autoOpen?:boolean;
  value: string;
  onChange: (value: string) => void;
  onPreview?: (value: string) => void;
  onCancel?:()=>void;
};
/** Shared picker inputs preview once per frame; acceptance commits once. */
export function ColorInput({ value, onChange, onPreview, onCancel, autoOpen=false, ...props }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const callbacks = useRef({ onChange, onPreview, onCancel }); callbacks.current = { onChange, onPreview, onCancel };
  const [draft, setDraft] = useState(value);
  const editing = useRef(false),opened=useRef(false);
  const committed = useRef(value), pending = useRef(value);
  useEffect(() => { if (!editing.current) { committed.current = value; pending.current = value; setDraft(value); } }, [value]);
  useEffect(() => {
    const element = input.current!;
    const commit = () => {
      const next = editing.current ? pending.current : element.value;
      pending.current = next; setDraft(next);
      const changed = next !== committed.current || editing.current;
      editing.current = false; committed.current = next;
      if (changed) callbacks.current.onChange(next);
    };
    element.addEventListener("change", commit);
    return () => {
      closeColorPicker(element);
      element.removeEventListener("change", commit);
    };
  }, []);
  useCancelValueEdit(input, () => {
    if (!editing.current) return;
    editing.current = false; pending.current = committed.current; setDraft(committed.current);
    input.current!.value = committed.current;
    if(callbacks.current.onCancel)callbacks.current.onCancel();else callbacks.current.onPreview?.(committed.current);
  });
  // Open after native change listeners and ancestor popup layout are ready.
  useEffect(()=>{
    const node=input.current;if(!autoOpen||props.disabled||opened.current||!node)return;
    opened.current=true;node.value=value;pending.current=committed.current=value;setDraft(value);
    openColorPicker(node);
  },[autoOpen,props.disabled,value]);
  return <input {...props} ref={input} type="color" value={draft} onChange={() => {}} onInput={event => {
    editing.current = true; pending.current = event.currentTarget.value;
    setDraft(pending.current); callbacks.current.onPreview?.(pending.current);
  }} />;
}
