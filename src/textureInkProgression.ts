import {textureFieldRows} from './properties/fieldCoordinates.ts';
import {isImageField,hasPalettePaint} from './properties/focusPalette.ts';
import {textureTextStream} from './properties/textStream.ts';
import {focusPaletteAxis} from './properties/focusPalette.ts';
import * as T from 'three';
import {scanInk} from './properties/inkProgression.ts';
import type {TextPalette} from './properties/textPalette.ts';
const empty=new T.DataTexture(new Float32Array(4),1,1,T.RGBAFormat,T.FloatType);empty.needsUpdate=true;
const states=new WeakMap<T.Material,{bounds:{value:T.Vector2};field:{value:number};left:{value:number};enabled:{value:number};stream:{value:number};scale:{value:number};total:{value:number};axis:{value:0|1};table:{value:T.Texture};size:{value:T.Vector2};tableWidth:{value:number};rows:{value:T.Vector3};texture?:T.DataTexture;source?:HTMLCanvasElement}>();
export function initializeTextureInkProgression(material:T.Material){const state={bounds:{value:new T.Vector2(1,1)},field:{value:0},left:{value:0},enabled:{value:0},stream:{value:0},scale:{value:1},total:{value:1},axis:{value:0 as 0|1},table:{value:empty as T.Texture},size:{value:new T.Vector2(1,1)},tableWidth:{value:1},rows:{value:new T.Vector3(0,1,1)},texture:undefined as T.DataTexture|undefined,source:undefined as HTMLCanvasElement|undefined};states.set(material,state);material.addEventListener('dispose',()=>{state.texture?.dispose();state.texture=undefined;});return {textFieldBounds:state.bounds,textFieldScan:state.field,textFieldLeft:state.left,textStream:state.stream,textStreamScale:state.scale,textStreamTotal:state.total,textInkScan:state.enabled,textInkAxis:state.axis,textInkColumns:state.table,textInkSize:state.size,textInkTableWidth:state.tableWidth,textInkRows:state.rows};}
export function configureTextureInkRows(material:T.Material,start:number,height:number,count:number){states.get(material)?.rows.value.set(start,height,count);}
/** Reuses the blue coverage channel for within-column rank; one small table holds column starts. */
export function refreshTextureInkProgression(material:T.MeshBasicMaterial){const state=states.get(material);if(!state||!state.enabled.value&&!state.stream.value&&!state.field.value)return;const canvas=material.map?.image as HTMLCanvasElement|undefined;if(!canvas?.getContext)return;
 state.texture?.dispose();const ctx=canvas.getContext('2d',{willReadFrequently:true})!,image=ctx.getImageData(0,0,canvas.width,canvas.height),rows=[0];for(let i=1;i<state.rows.value.z;i++)rows.push(Math.min(canvas.height,state.rows.value.x+i*state.rows.value.y));rows.push(canvas.height);
 if(state.field.value){const field=textureFieldRows(canvas.width,canvas.height,image.data,rows);state.size.value.set(canvas.width,canvas.height);state.source=canvas;state.left.value=field.left;state.bounds.value.set(field.width,Math.max(1,field.height));const texture=new T.DataTexture(field.table,1,rows.length-1,T.RGBAFormat,T.FloatType);texture.minFilter=texture.magFilter=T.NearestFilter;texture.needsUpdate=true;state.texture=texture;state.table.value=texture;return;}
 if(state.stream.value){const stream=textureTextStream(canvas.width,canvas.height,image.data,rows);state.size.value.set(canvas.width,canvas.height);state.source=canvas;state.total.value=Math.max(1,stream.total);const texture=new T.DataTexture(stream.table,1,rows.length-1,T.RGBAFormat,T.FloatType);texture.minFilter=texture.magFilter=T.NearestFilter;texture.needsUpdate=true;state.texture=texture;state.table.value=texture;return;}
 const scan=scanInk(canvas.width,canvas.height,image.data,0,4,rows,state.axis.value);
 for(let row=0;row<rows.length-1;row++)for(let y=rows[row];y<rows[row+1];y++)for(let x=0;x<canvas.width;x++){const count=scan.columns[(row*scan.major+(scan.axis===1?y-rows[row]:x))*4+1];image.data[(y*canvas.width+x)*4+2]=Math.round(scan.ranks[y*canvas.width+x]/Math.max(1,count-1)*255);}
 ctx.putImageData(image,0,0);material.map!.needsUpdate=true;state.size.value.set(canvas.width,canvas.height);state.source=canvas;state.tableWidth.value=scan.major;
 const texture=new T.DataTexture(scan.columns,scan.major,rows.length-1,T.RGBAFormat,T.FloatType);texture.minFilter=texture.magFilter=T.NearestFilter;texture.needsUpdate=true;state.texture=texture;state.table.value=texture;
}
export function updateTextureInkProgression(material:T.Material,palette?:TextPalette){const state=states.get(material);if(!state)return;const field=isImageField(palette),fieldChanged=state.field.value!==Number(field);state.field.value=Number(field);const stream=!field&&palette?.progression==='start-end'&&palette.colors.length>1,active=(field||palette?.progression==='ink-serpentine'||stream)&&hasPalettePaint(palette);const modeChanged=state.stream.value!==Number(stream);state.stream.value=Number(stream);state.scale.value=palette?.scale??1;
 if(!active){state.enabled.value=0;state.texture?.dispose();state.texture=undefined;state.table.value=empty;state.source=undefined;return;}
 const axis=focusPaletteAxis(palette!),changed=axis!==state.axis.value;state.axis.value=axis;state.enabled.value=stream||field?0:1;const source=(material as T.MeshBasicMaterial).map?.image;if(state.texture&&source===state.source&&!changed&&!modeChanged&&!fieldChanged)return;refreshTextureInkProgression(material as T.MeshBasicMaterial);
 if(!state.texture)state.enabled.value=0;
}
export const inkProgressionShader=`
uniform bool textInkScan;
uniform bool textFieldScan;
uniform float textFieldLeft;
uniform vec2 textFieldBounds;
uniform bool textStream;
uniform float textStreamScale;
uniform float textStreamTotal;
uniform int textInkAxis;
uniform sampler2D textInkColumns;
uniform vec2 textInkSize;
uniform float textInkTableWidth;
uniform vec3 textInkRows;
vec2 nativeFieldPosition(vec2 uv){
 vec2 native=vec2(uv.x,1.0-uv.y)*textInkSize;
 float row=clamp(floor((native.y-textInkRows.x)/textInkRows.y),0.0,textInkRows.z-1.0);
 vec3 part=texture2D(textInkColumns,vec2(0.5,(row+0.5)/textInkRows.z)).rgb;
 return vec2(native.x-textFieldLeft,part.r+clamp(native.y-part.g,0.0,part.b));
}
vec2 textFieldPosition(vec2 uv,float pixelRatio){
 vec2 screen=vec2(1.0/max(length(vec2(dFdx(uv.x),dFdy(uv.x)))*textInkSize.x*pixelRatio,0.000001),1.0/max(length(vec2(dFdx(uv.y),dFdy(uv.y)))*textInkSize.y*pixelRatio,0.000001));
 return nativeFieldPosition(uv)*screen;
}
float textStreamPosition(vec2 uv){
 float row=clamp(floor(((1.0-uv.y)*textInkSize.y-textInkRows.x)/textInkRows.y),0.0,textInkRows.z-1.0);
 vec3 part=texture2D(textInkColumns,vec2(0.5,(row+0.5)/textInkRows.z)).rgb;
 return (part.r+clamp(uv.x*textInkSize.x-part.g,0.0,part.b))/textStreamTotal/textStreamScale;
}
float inkScanPosition(vec2 uv,vec4 coverage,float pixelRatio){
 vec2 flow=textInkAxis==1?vec2(1.0-uv.y,uv.x):vec2(uv.x,1.0-uv.y);
 vec2 size=textInkAxis==1?textInkSize.yx:textInkSize;
 float nativeX=flow.x*size.x,nativeY=flow.y*size.y;
 float row=clamp(floor(((1.0-uv.y)*textInkSize.y-textInkRows.x)/textInkRows.y),0.0,textInkRows.z-1.0);
 float origin=textInkAxis==1&&row>0.0?textInkRows.x+row*textInkRows.y:0.0;
 vec3 column=texture2D(textInkColumns,vec2((floor(nativeX-origin)+0.5)/textInkTableWidth,(row+0.5)/textInkRows.z)).rgb;
 float sx=1.0/max(length(vec2(dFdx(flow.x),dFdy(flow.x)))*size.x*pixelRatio,0.000001);
 float sy=1.0/max(length(vec2(dFdx(flow.y),dFdy(flow.y)))*size.y*pixelRatio,0.000001);
 float subColumn=floor(fract(nativeX)*sx),rank=floor(coverage.b*max(0.0,column.g-1.0)+0.5);
 float y=(rank+fract(nativeY))*sy,up=1.0-step(1.0,mod(floor(column.b*sx)+subColumn+(textInkAxis==1?1.0:0.0),2.0));
 return column.r*sx*sy+subColumn*column.g*sy+mix(y,max(0.0,column.g*sy-y),up);
}
`;
