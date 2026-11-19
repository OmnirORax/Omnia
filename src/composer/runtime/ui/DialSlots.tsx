import type {ButtonHTMLAttributes,ReactNode} from 'react';
import './mathematicalDial.css';
export {dialRingSlots} from './dialSlots.ts';
import {dialRingSlots} from './dialSlots.ts';
export type DialSlotLayout=ReturnType<typeof dialRingSlots>[number];
/** Shared selectable marks; each consumer owns the meaning of its marks. */
export function DialSlot({slot,selected,preview=false,children,...props}:Omit<ButtonHTMLAttributes<HTMLButtonElement>,'slot'>&{slot:DialSlotLayout;selected:boolean;preview?:boolean;children?:ReactNode}){return <button type="button" {...props} className={`mathematical-dial-slot ${props.className??''}`} data-math-slot={slot.key} data-selected={selected} data-preview={preview} aria-pressed={props['aria-pressed']??selected} style={{width:slot.size,height:slot.size,left:`${slot.left}%`,top:`${slot.top}%`,...props.style}}>{children??<span className="mathematical-dial-mark" aria-hidden="true"/>}</button>;}
