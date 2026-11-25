import test from 'node:test';
import assert from 'node:assert/strict';
import {PALETTE_FAMILIES} from '../src/scene/palette.ts';
import {comboPalette,imageColorCombo,matchedImageColors} from '../src/scene/colorCombo.ts';
import {validPaletteSettings,validTextPalette} from '../src/properties/textPalette.ts';
import {acquireImagePixelInk} from '../src/properties/imagePixelInk.ts';
import {emptyWorld} from '../src/core/model.ts';
import {configureAutoColors,createAutoColors} from '../src/scene/autoColors.ts';
import {readPaint} from '../src/core/appearance.ts';

const width=24,height=12;
function sample(){
 const pixels=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const green=x>=2&&x<=4&&y>=2&&y<=4||x>=15&&x<=17&&y>=7&&y<=8;
  const blue=x>=6&&x<=7&&y>=2&&y<=4;
  pixels.set(green?[0,200,0,255]:blue?[0,60,250,255]:[250,0,0,255],(y*width+x)*4);
 }
 return {pixels,width,height};
}
const settings={distribution:'pixels',repeatMotifs:true,ink:'pale',motifOverrides:{h0:false,h3:true,h5:true}};
const family=id=>PALETTE_FAMILIES.indexOf(id);

test('neighboring accents stay in one unscaled source patch and distant shapes stay separate',()=>{
 const combo=imageColorCombo(sample());
 const motifs=matchedImageColors(combo,settings,'scene-a').textPixelMotifs;
 assert.equal(motifs.patches.length,2);
 assert.deepEqual(motifs.patches.map(patch=>patch.source),[[1/width,1/height,8/width,5/height],[14/width,6/height,5/width,4/height]]);
 assert.equal(motifs.owners[family('h0')],-1);
 assert.notEqual(motifs.owners[family('h3')],motifs.owners[family('h5')]);
 assert.ok(motifs.size[0]<1&&motifs.size[1]<1);
 const next=matchedImageColors(combo,{...settings,scale:.5,paleAmount:.99},'scene-a');
 assert.equal(next.textPixelMotifs,motifs,'scale and Pale reuse the extracted layout');
});

test('the motif lookup masks excluded hues while the standard pixel lookup still remaps them',()=>{
 const combo=matchedImageColors(imageColorCombo(sample()),settings,'scene-a'),palette=comboPalette(combo,settings);
 const ink=acquireImagePixelInk(palette);
 try{
  const {width,data}=ink.texture.image;
  const texel=(row,hue)=>[...data.slice((row*width+hue)*4,(row*width+hue)*4+4)];
  assert.equal(texel(0,0)[3],255);
  assert.equal(texel(2,0)[3],0);
  assert.deepEqual(texel(2,120).slice(0,3),[0,255,0]);
  const blue=texel(2,225);assert.ok(blue[2]>blue[1]&&blue[2]>blue[0]&&blue[3]===255);
 }finally{ink.release();}
});

test('single accents use Pale to show their shapes and manual crops are specific to an image',()=>{
 const combo=imageColorCombo(sample());
 const solo={...settings,motifOverrides:{...settings.motifOverrides,h5:false}};
 assert.equal(matchedImageColors(combo,solo,'scene-a').textPixelMotifs.patches.length,2);
 assert.equal(matchedImageColors(combo,{...solo,ink:'color'},'scene-a').textPixelMotifs,undefined);
 const rect=[.3,.4,.15,.2],manual={...settings,motifCrop:{image:'scene-a',rect}};
 const result=matchedImageColors(combo,manual,'scene-a').textPixelMotifs;
 assert.deepEqual(result.size,rect.slice(2));
 assert.deepEqual(result.patches,[{source:rect,x:0,y:0}]);
 assert.equal(matchedImageColors(combo,manual,'scene-b').textPixelMotifs.patches.length,2);
 assert.equal(validPaletteSettings({...manual,motifCrop:{image:'scene-a',rect:[.9,.2,.3,.1]}}),false);
});

test('automatic colors apply and persist the bounded layout through the normal text paint path',async()=>{
 const world=emptyWorld(),controller=createAutoColors({read:()=>world,change:edit=>edit(world),sample:async()=>sample(),error:error=>{throw error;}});
 try{
  configureAutoColors(world,undefined,true,false,settings);controller.update();await controller.settle();
  const paint=readPaint(world,'text'),restored=JSON.parse(JSON.stringify(paint.palette));
  assert.equal(restored.pixelMotifs.patches.length,2);
  assert.ok(validTextPalette(restored));
  configureAutoColors(world,undefined,true,false,{repeatMotifs:false});controller.update();await controller.settle();
  assert.equal(readPaint(world,'text').palette.pixelMotifs,undefined);
 }finally{controller.dispose();}
});
