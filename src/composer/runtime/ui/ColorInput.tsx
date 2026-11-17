import {createColorSession} from '../../../ui/colorSession.ts';
import { useCancelValueEdit } from "./ActiveContext";
import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "onInput"> & {
  autoOpen?:boolean;
  value: string;
  onChange: (value: string) => void;
  onPreview?: (value: string) => void;
  onCancel?:()=>void;
};
/** Native input previews stay outside document/history persistence. Native change
 * commits once when the picker is accepted; blur is a fallback for browser pickers. */
export function ColorInput({ value, onChange, onPreview, onCancel, autoOpen=false, ...props }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const callbacks = useRef({ onChange, onPreview, onCancel }); callbacks.current = { onChange, onPreview, onCancel };
  const [draft, setDraft] = useState(value);
  const opened=useRef(false);
  const session=useRef<ReturnType<typeof createColorSession>|undefined>(undefined);
  session.current??=createColorSession({value,preview:next=>callbacks.current.onPreview?.(next),commit:next=>callbacks.current.onChange(next),cancel:()=>{if(callbacks.current.onCancel)callbacks.current.onCancel();else callbacks.current.onPreview?.(session.current!.value);}});
  useEffect(()=>{session.current!.sync(value);if(!session.current!.editing)setDraft(value);},[value]);
  useEffect(()=>{
    const node=input.current!,commit=()=>{session.current!.accept(node.value);setDraft(session.current!.value);};
    node.addEventListener('change',commit);node.addEventListener('blur',commit);
    return()=>{node.removeEventListener('change',commit);node.removeEventListener('blur',commit);session.current!.cancel();};
  },[]);
  useCancelValueEdit(input,()=>{session.current!.cancel();input.current!.value=session.current!.value;setDraft(session.current!.value);});
  // Open after native change listeners and ancestor popup layout are ready.
  useEffect(()=>{
    const node=input.current;if(!autoOpen||props.disabled||opened.current||!node)return;
    opened.current=true;node.value=value;session.current!.sync(value);setDraft(value);
    try{if(node.showPicker)node.showPicker();else node.click();}catch{/* Restricted/programmatic entry leaves the current-color swatch available. */}
  },[autoOpen,props.disabled,value]);
  return <input {...props} ref={input} type="color" value={draft} onChange={()=>{}} onInput={event=>{const next=event.currentTarget.value;setDraft(next);session.current!.input(next);}} />;
}
