export type RotationSnapMode='axis'|'unit';
/** Fractions of one turn. Axis order 1 bisects a line's half-turn period. */
export function rotationStep(mode:RotationSnapMode,value:number,radius=1){
 if(!Number.isInteger(value)||value< -8||value>16||!Number.isFinite(radius)||radius<=0)throw Error('Invalid rotation snap.');
 const base=mode==='axis'?1/4:Math.asin(Math.min(1,1/(2*radius)))/Math.PI;
 return base*2**(1-value);
}
export function snappedRotation(dy:number,mode:RotationSnapMode,value:number,radius=1){return Math.round(dy/24)*rotationStep(mode,value,radius);}
