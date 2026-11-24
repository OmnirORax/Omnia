import * as T from 'three';
import {scanInk} from './properties/inkProgression.ts';
import type {TextPalette} from './properties/textPalette.ts';
const empty=new T.DataTexture(new Float32Array(4),1,1,T.RGBAFormat,T.FloatType);empty.needsUpdate=true;
const states=new WeakMap<T.Material,{enabled:{value:number};table:{value:T.Texture};size:{value:T.Vector2};rows:{value:T.Vector3};texture?:T.DataTexture;source?:HTMLCanvasElement}>();
export function initializeTextureInkProgression(material:T.Material){const state={enabled:{value:0},table:{value:empty as T.Texture},size:{value:new T.Vector2(1,1)},rows:{value:new T.Vector3(0,1,1)},texture:undefined as T.DataTexture|undefined,source:undefined as HTMLCanvasElement|undefined};states.set(material,state);material.addEventListener('dispose',()=>{state.texture?.dispose();state.texture=undefined;});return {textInkScan:state.enabled,textInkColumns:state.table,textInkSize:state.size,textInkRows:state.rows};}
export function configureTextureInkRows(material:T.Material,start:number,height:number,count:number){states.get(material)?.rows.value.set(start,height,count);}
/** Reuses the blue coverage channel for within-column rank; one small table holds column starts. */
export function refreshTextureInkProgression(material:T.MeshBasicMaterial){const state=states.get(material);if(!state?.enabled.value)return;const canvas=material.map?.image as HTMLCanvasElement|undefined;if(!canvas?.getContext)return;
 state.texture?.dispose();const ctx=canvas.getContext('2d',{willReadFrequently:true})!,image=ctx.getImageData(0,0,canvas.width,canvas.height),rows=[0];for(let i=1;i<state.rows.value.z;i++)rows.push(Math.min(canvas.height,state.rows.value.x+i*state.rows.value.y));rows.push(canvas.height);
 const scan=scanInk(canvas.width,canvas.height,image.data,0,4,rows);
 for(let row=0;row<rows.length-1;row++)for(let y=rows[row];y<rows[row+1];y++)for(let x=0;x<canvas.width;x++){const count=scan.columns[(row*canvas.width+x)*4+1];image.data[(y*canvas.width+x)*4+2]=Math.round(scan.ranks[y*canvas.width+x]/Math.max(1,count-1)*255);}
 ctx.putImageData(image,0,0);material.map!.needsUpdate=true;state.size.value.set(canvas.width,canvas.height);state.source=canvas;
 const texture=new T.DataTexture(scan.columns,canvas.width,rows.length-1,T.RGBAFormat,T.FloatType);texture.minFilter=texture.magFilter=T.NearestFilter;texture.needsUpdate=true;state.texture=texture;state.table.value=texture;
}
export function updateTextureInkProgression(material:T.Material,palette?:TextPalette){const state=states.get(material);if(!state)return;const active=palette?.progression==='ink-serpentine'&&palette.colors.length>1;
 if(!active){state.enabled.value=0;state.texture?.dispose();state.texture=undefined;state.table.value=empty;state.source=undefined;return;}
 state.enabled.value=1;const source=(material as T.MeshBasicMaterial).map?.image;if(state.texture&&source===state.source)return;refreshTextureInkProgression(material as T.MeshBasicMaterial);
 if(!state.texture)state.enabled.value=0;
}
export const inkProgressionShader=`
uniform bool textInkScan;
uniform sampler2D textInkColumns;
uniform vec2 textInkSize;
uniform vec3 textInkRows;
float inkScanPosition(vec2 uv,vec4 coverage,float pixelRatio){
 float nativeX=uv.x*textInkSize.x,nativeY=(1.0-uv.y)*textInkSize.y;
 float row=clamp(floor((nativeY-textInkRows.x)/textInkRows.y),0.0,textInkRows.z-1.0);
 vec3 column=texture2D(textInkColumns,vec2((floor(nativeX)+0.5)/textInkSize.x,(row+0.5)/textInkRows.z)).rgb;
 float sx=1.0/max(length(vec2(dFdx(uv.x),dFdy(uv.x)))*textInkSize.x*pixelRatio,0.000001);
 float sy=1.0/max(length(vec2(dFdx(uv.y),dFdy(uv.y)))*textInkSize.y*pixelRatio,0.000001);
 float subColumn=floor(fract(nativeX)*sx),rank=floor(coverage.b*max(0.0,column.g-1.0)+0.5);
 float y=floor((rank+fract(nativeY))*sy),up=1.0-step(1.0,mod(floor(column.b*sx)+subColumn,2.0));
 return column.r*sx*sy+subColumn*column.g*sy+mix(y,max(0.0,column.g*sy-1.0-y),up);
}
`;
