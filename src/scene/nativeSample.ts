import {sampleSceneGrid,type SceneSample} from './palette.ts';
import {registerNativeField} from '../properties/nativeField.ts';
/** Decode/read at native size; only motif detection gets a small sample. */
export async function nativeSceneSample(image:ImageBitmap,key:string,classify:(pixels:Uint8ClampedArray)=>Promise<Uint8Array>):Promise<SceneSample>{
 if(image.width>4096||image.height>4096||image.width*image.height>12_000_000)throw Error('Scene exceeds the existing native image limit.');
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Native pattern decoding is unavailable.');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,image.width,image.height).data,sample=sampleSceneGrid(pixels,image.width,image.height),indices=await classify(pixels);canvas.width=canvas.height=1;registerNativeField(key,image.width,image.height,indices);return {...sample,native:{key,width:image.width,height:image.height}};
}
