export type RotationSnapMode='axis'|'unit';
export function rotationBaseStep(mode:RotationSnapMode,radius=1){if(!Number.isFinite(radius)||radius<=0)throw Error('Invalid rotation radius.');return mode==='axis'?1/4:Math.asin(Math.min(1,1/(2*radius)))/Math.PI;}
/** Fractions of one turn. Axis order 1 bisects a line's half-turn period. */
export function rotationStep(mode:RotationSnapMode,value:number,radius=1){
 if(!Number.isInteger(value)||!Number.isFinite(radius)||radius<=0)throw Error('Invalid rotation snap.');
 const base=rotationBaseStep(mode,radius);
 return base*2**(1-value);
}
export function snappedRotation(dy:number,mode:RotationSnapMode,value:number,radius=1){return Math.round(dy/24)*rotationStep(mode,value,radius);}
