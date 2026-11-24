import {WORLD_TEXT_LAYER,nativeTextMaterial} from './textPass.ts';
import {textGlowLayers} from '../properties/textGlow.ts';
import {packedTextureGlow,packGlowCoverage,updateTextureGlowColor} from '../textureGlow.ts';
import {imageHull} from './contentEnvelope.ts';
import * as THREE from 'three';
import {labelLines,labelSize} from '../composer/runtime/graph/labels.ts';
import {fontFamily,fontSizeScale, TEXT_DEFAULTS,renderedTextPaint,type Paint} from '../properties/visual.ts';
import {isImportedFont} from '../properties/importedFont.ts';
type FontId=string;
const canvasFont=(id:FontId)=>`${id==='electric'||isImportedFont(id)?400:500} 36px ${fontFamily(id)}`;
type SurfaceStyle={background?:string;contour?:string;opacity?:number;contourOpacity?:number;backgroundGlow?:number;contourGlow?:number};
// One CPU staging canvas, reused synchronously on content/style changes only.
let sharpTextCanvas:HTMLCanvasElement|undefined;
function sharpTextContext(width:number,height:number){
 const canvas=sharpTextCanvas??=document.createElement('canvas');canvas.width=width;canvas.height=height;
 return canvas.getContext('2d',{willReadFrequently:true})!;
}
export function textSprite(value: string, color: string, selected = false, node = false, neon = false, font: FontId = "system", textGlow = 0, textColor = color, surface: SurfaceStyle = {}, contentOnly = false, columns = 32, textGlowSpread:number=TEXT_DEFAULTS.glowSpread) {
  const lines = labelLines(value,columns),
    canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d",{willReadFrequently:contentOnly})!;
  measure.font = canvasFont(font);
  canvas.width = Math.ceil(
    Math.max(100, ...lines.map((line) => measure.measureText(line).width)) + 36,
  );
  canvas.height = lines.length * 48 + 20;
  const ctx = canvas.getContext("2d",{willReadFrequently:contentOnly})!;
  const drawInk=(context:CanvasRenderingContext2D,ink:string,glow:number,spread:number)=>{
    context.font=canvasFont(font);context.textAlign='center';context.textBaseline='middle';context.fillStyle=ink;
    const draw=()=>lines.forEach((line,i)=>context.fillText(line,canvas.width/2,10+24+i*48));
    context.shadowColor=ink;
    for(const layer of textGlowLayers(glow,spread)){context.globalAlpha=layer.opacity;context.shadowBlur=layer.blur;draw();}
    // Clean ink stays fully covered, independently of halo strength.
    context.globalAlpha=1;context.shadowBlur=0;draw();
  };
  const paint = (border: string, ink: string, glow: number, spread:number=TEXT_DEFAULTS.glowSpread) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.shadowBlur = 0;
    if (!contentOnly && node) {
      ctx.fillStyle = surface.background ?? (neon ? selected ? "#063c50ed" : "#041923cc" : selected ? "#203b59" : "#101e2deb");
      ctx.beginPath();
      ctx.roundRect(1, 1, canvas.width - 2, canvas.height - 2, 12);
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = (surface.backgroundGlow ?? 0) * 10;
      ctx.globalAlpha = surface.opacity ?? 1; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = surface.contour ?? (selected ? neon ? "#69efff" : "#b9dcff" : border);
      ctx.lineWidth = selected ? 3 : 1;
      ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=(surface.contourGlow??0)*10;
      ctx.globalAlpha = surface.contourOpacity ?? (selected ? 1 : 0.35);
      ctx.stroke();
      ctx.globalAlpha = 1;

    } else if (!contentOnly) {
      ctx.fillStyle = surface.background ?? (neon ? "#04121bd9" : "#101927ee");
      ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=(surface.backgroundGlow??0)*10;
      ctx.globalAlpha = surface.opacity ?? 1;
      ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1;
    }
    drawInk(ctx,contentOnly?"#ffffff":ink,glow,spread);
    if(contentOnly){
      const combined=ctx.getImageData(0,0,canvas.width,canvas.height);
      if(glow>0){const clean=sharpTextContext(canvas.width,canvas.height);drawInk(clean,"#ffffff",0,spread);packGlowCoverage(clean.getImageData(0,0,canvas.width,canvas.height).data,combined.data);}
      else packGlowCoverage(combined.data,combined.data);
      ctx.putImageData(combined,0,0);
    }
  };
  paint(color, textColor, textGlow,textGlowSpread);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = contentOnly?THREE.NoColorSpace:THREE.SRGBColorSpace;
  // Minification must integrate the texels covered by each screen pixel.
  // Bilinear-only sampling skips thin glyph strokes at reduced world scales.
  // GPU mip levels provide coverage without per-zoom canvas redraws or passes.
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const sprite = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: texture,
      color:contentOnly?textColor:0xffffff,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    }),
  );
  if(contentOnly){packedTextureGlow(sprite.material);nativeTextMaterial(sprite.material);sprite.layers.set(WORLD_TEXT_LAYER);}
  sprite.userData.lightningMask = () => {
    const mask = document.createElement("canvas"); mask.width = canvas.width; mask.height = canvas.height;
    const ink = mask.getContext("2d")!; ink.font = canvasFont(font);
    ink.textAlign = "center"; ink.textBaseline = "middle"; ink.fillStyle = "white";
    lines.forEach((line, i) => ink.fillText(line, mask.width / 2, 10 + 24 + i * 48));
    return mask;
  };
  let hull:ReturnType<typeof imageHull>|undefined;
  sprite.userData.contentHull=()=>hull??=imageHull(sprite.userData.lightningMask());
  let currentStyle: [string, string, number,number] = [color, textColor, textGlow,textGlowSpread];
  let surfaceKey = JSON.stringify(surface);
  sprite.userData.setSurfaceStyle = (next: typeof surface) => {
    const key = JSON.stringify(next); if (key === surfaceKey) return;
    surfaceKey = key; surface = next; if(!contentOnly){paint(...currentStyle); texture.needsUpdate = true;}
  };
  sprite.userData.setSelected = (value: boolean) => {
    if (value === selected) return;
    selected = value; if(!contentOnly){paint(...currentStyle); texture.needsUpdate = true;}
  };
  let paintKey = JSON.stringify([color, textColor, textGlow,textGlowSpread]);
  sprite.userData.setTextStyle = (border: string, ink: string, glow: number, spread:number=TEXT_DEFAULTS.glowSpread) => {
    const next = JSON.stringify([border, ink, glow,spread]);
    if (next === paintKey) return;
    paintKey = next;
    const rasterChanged=!contentOnly||glow!==currentStyle[2]||spread!==currentStyle[3];
    currentStyle = [border, ink, glow,spread];
    if(contentOnly){sprite.material.color.set(ink);updateTextureGlowColor(sprite.material,sprite.userData.glowColor??ink);}
    if(rasterChanged){paint(border,ink,glow,spread);texture.needsUpdate=true;}
    sprite.userData.textColor = ink;
  };
  sprite.userData.label = value;
  sprite.userData.textColor = textColor;
  sprite.userData.aspect = canvas.width / canvas.height;
  sprite.userData.lines = lines.length;
  sprite.userData.wrapColumns = columns;
  const size = labelSize(value,columns);
  sprite.scale.set(size.height*(canvas.width/canvas.height), size.height, 1);
  return sprite;
}
/** Only typography changes text geometry. Color/opacity/glow reuse the label. */
export const labelGeometryKey=(paint:Paint={},revision=0)=>JSON.stringify([paint.font??TEXT_DEFAULTS.font,revision]);
export function updateLabelPaint(mesh:ReturnType<typeof textSprite>,paint:Paint={}){
 const style={...TEXT_DEFAULTS,...paint},rendered=renderedTextPaint(style);
 const nextScale=fontSizeScale(style),oldScale=mesh.userData.labelFontScale??1;if(nextScale!==oldScale){mesh.scale.multiplyScalar(nextScale/oldScale);mesh.userData.labelFontScale=nextScale;}
 mesh.userData.setTextStyle(rendered.color,rendered.color,style.glow,style.glowSpread);
 updateTextureGlowColor(mesh.material,rendered.glowColor);mesh.userData.glowColor=style.glowColor===undefined?undefined:rendered.glowColor;
 mesh.material.opacity=1;
 mesh.userData.labelPaint=style;mesh.userData.textColor=rendered.color;
}
export function label(caption:string,paint?:Paint){
 const style={...TEXT_DEFAULTS,...paint};
 const mesh=textSprite(caption,style.color,false,false,false,style.font,style.glow,style.color,{},true,32,style.glowSpread);
 updateLabelPaint(mesh,style);mesh.userData.isLabel=true;
 if(style.font==='electric'||isImportedFont(style.font))void document.fonts.load(canvasFont(style.font)).then(()=>{
   if(mesh.userData.disposed)return;
   const current=mesh.userData.labelPaint as typeof style;
   const fresh=textSprite(caption,current.color,false,false,false,current.font,current.glow,current.color,{},true,32,current.glowSpread);
   mesh.material.map?.dispose();mesh.material.dispose();mesh.material=fresh.material;
   for(const name of ['setTextStyle','setSurfaceStyle','setSelected','lightningMask','contentHull'])mesh.userData[name]=fresh.userData[name];
   mesh.userData.aspect=fresh.userData.aspect;mesh.scale.copy(fresh.scale);mesh.userData.labelFontScale=1;
   updateLabelPaint(mesh,current);fresh.geometry.dispose();mesh.userData.requestRender?.();
 });
 return mesh;
}
export function disposeLabel(mesh:ReturnType<typeof label>){mesh.userData.disposed=true;mesh.geometry.dispose();mesh.material.map?.dispose();mesh.material.dispose();}
