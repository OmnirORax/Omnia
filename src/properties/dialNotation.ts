import type {MathematicalMarks} from './mathematicalDial.ts';
export type DialNotation={base:1|2;clockwise:boolean;marks:MathematicalMarks};
/** A number retains its actual strokes, including recursion and ring addresses. */
export function copyDialNotation(notation:DialNotation):DialNotation{return {base:notation.base,clockwise:notation.clockwise,marks:{selected:[...notation.marks.selected],modes:{...notation.marks.modes}}};}
