export type RotationSnapMode='axis'|'unit';
/** Modes choose an initial angle in turns. Edits replace it directly. */
export function rotationDefaultSnap(mode:RotationSnapMode,radius=1){if(!Number.isFinite(radius)||radius<=0)throw Error('Invalid rotation radius.');return mode==='axis'?1/4:Math.asin(Math.min(1,1/(2*radius)))/Math.PI;}
