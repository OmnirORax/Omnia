import {PALETTE_FAMILIES} from '../scene/palette.ts';

/** Coordinates use the source image, with the origin at its top left. */
export type MotifRect=readonly [x:number,y:number,width:number,height:number];
export type MotifCrop={image:string;rect:MotifRect};
export type PixelMotifs={image?:string;owners:readonly number[];size:readonly [number,number];patches:readonly {source:MotifRect;x:number;y:number}[]};
export const PIXEL_MOTIF_LIMIT=8;

const validImage=(image:unknown)=>typeof image==='string'&&image.length>0&&image.length<=200;
function validRect(rect:unknown):rect is MotifRect{
 if(!Array.isArray(rect)||rect.length!==4||!rect.every(Number.isFinite))return false;
 const [x,y,w,h]=rect;
 return x>=0&&y>=0&&w>0&&h>0&&x+w<=1+1e-9&&y+h<=1+1e-9;
}
export function validMotifCrop(value:unknown):value is MotifCrop{
 const crop=value as MotifCrop|undefined;
 return !!crop&&validImage(crop.image)&&validRect(crop.rect);
}
export function validPixelMotifs(value:unknown,colorCount:number){
 const motifs=value as PixelMotifs|undefined;
 if(!motifs||motifs.image!==undefined&&!validImage(motifs.image)||!Array.isArray(motifs.size)||motifs.size.length!==2||!motifs.size.every(n=>Number.isFinite(n)&&n>0&&n<=PIXEL_MOTIF_LIMIT*2))return false;
 const [width,height]=motifs.size;
 return Array.isArray(motifs.owners)&&motifs.owners.length===PALETTE_FAMILIES.length&&motifs.owners.every(n=>Number.isInteger(n)&&n>=-1&&n<colorCount)
  &&Array.isArray(motifs.patches)&&motifs.patches.length>0&&motifs.patches.length<=PIXEL_MOTIF_LIMIT&&motifs.patches.every(p=>p&&Number.isFinite(p.x)&&p.x>=0&&Number.isFinite(p.y)&&p.y>=0&&validRect(p.source)&&p.x+p.source[2]<=width+1e-9&&p.y+p.source[3]<=height+1e-9);
}
