import {renderedTextPaint,type Paint} from './visual.ts';
import type {TextGradient} from './textGradient.ts';
export type TextPaintSink={setColor:(color:string)=>void;setGlow:(color:string,strength:number,spread:number)=>void;setGradient?:(gradient:TextGradient|null,strength:number,spread:number)=>void};
/** One setter assigns text channels to every presentation. Adapters only write them. */
export function setTextPaint(target:TextPaintSink,paint:Paint={}){
 const value=renderedTextPaint(paint);target.setColor(value.color);target.setGlow(value.glowColor,value.glow,value.glowSpread);target.setGradient?.(value.gradient??null,value.glow,value.glowSpread);return value;
}
