import * as THREE from 'three';
import {labelLines,labelSize} from '../composer/runtime/graph/labels.ts';
import {fontFamily, TEXT_DEFAULTS,type Paint} from '../properties/visual.ts';
import {translucentOpacity} from '../properties/translucency.ts';
import {isImportedFont} from '../properties/importedFont.ts';
type FontId=string;
const canvasFont=(id:FontId)=>`${id==='electric'||isImportedFont(id)?400:500} 36px ${fontFamily(id)}`;
type SurfaceStyle={background?:string;contour?:string;opacity?:number;contourOpacity?:number;backgroundGlow?:number;contourGlow?:number};
export function textSprite(value: string, color: string, selected = false, node = false, neon = false, font: FontId = "system", textGlow = 0, textColor = color, surface: SurfaceStyle = {}, contentOnly = false, columns = 32) {
  const lines = labelLines(value,columns),
    canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d")!;
  measure.font = canvasFont(font);
  canvas.width = Math.ceil(
    Math.max(100, ...lines.map((line) => measure.measureText(line).width)) + 36,
  );
  canvas.height = lines.length * 48 + 20;
  const ctx = canvas.getContext("2d")!;
  const paint = (border: string, ink: string, glow: number) => {
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
    ctx.font = canvasFont(font);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ink;
    ctx.shadowColor = ink; ctx.shadowBlur = glow * 10;
    lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, 10 + 24 + i * 48));
  };
  paint(color, textColor, textGlow);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
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
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    }),
  );
  sprite.userData.lightningMask = () => {
    const mask = document.createElement("canvas"); mask.width = canvas.width; mask.height = canvas.height;
    const ink = mask.getContext("2d")!; ink.font = canvasFont(font);
    ink.textAlign = "center"; ink.textBaseline = "middle"; ink.fillStyle = "white";
    lines.forEach((line, i) => ink.fillText(line, mask.width / 2, 10 + 24 + i * 48));
    return mask;
  };
  let currentStyle: [string, string, number] = [color, textColor, textGlow];
  let surfaceKey = JSON.stringify(surface);
  sprite.userData.setSurfaceStyle = (next: typeof surface) => {
    const key = JSON.stringify(next); if (key === surfaceKey) return;
    surfaceKey = key; surface = next; paint(...currentStyle); texture.needsUpdate = true;
  };
  sprite.userData.setSelected = (value: boolean) => {
    if (value === selected) return;
    selected = value; paint(...currentStyle); texture.needsUpdate = true;
  };
  let paintKey = JSON.stringify([color, textColor, textGlow]);
  sprite.userData.setTextStyle = (border: string, ink: string, glow: number) => {
    const next = JSON.stringify([border, ink, glow]);
    if (next === paintKey) return;
    paintKey = next; currentStyle = [border, ink, glow]; paint(border, ink, glow); texture.needsUpdate = true;
    sprite.userData.textColor = ink;
  };
  sprite.userData.label = value;
  sprite.userData.textColor = textColor;
  sprite.userData.aspect = canvas.width / canvas.height;
  sprite.userData.lines = lines.length;
  sprite.userData.wrapColumns = columns;
  const size = labelSize(value,columns);
  sprite.scale.set(size.width, size.height, 1);
  return sprite;
}
export function label(caption:string,paint?:Paint){
 const style={...TEXT_DEFAULTS,...paint};
 const mesh=textSprite(caption,style.color,false,false,false,style.font,style.glow,style.color,{},true);
 mesh.material.opacity=translucentOpacity(1,style.translucency);mesh.userData.isLabel=true;
 if(style.font==='electric'||isImportedFont(style.font))void document.fonts.load(canvasFont(style.font)).then(()=>{
   if(mesh.userData.disposed)return;
   const fresh=textSprite(caption,style.color,false,false,false,style.font,style.glow,style.color,{},true);
   mesh.material.map?.dispose();mesh.material.map=fresh.material.map;mesh.material.needsUpdate=true;fresh.geometry.dispose();fresh.material.dispose();mesh.userData.requestRender?.();
 });
 return mesh;
}
export function disposeLabel(mesh:ReturnType<typeof label>){mesh.userData.disposed=true;mesh.geometry.dispose();mesh.material.map?.dispose();mesh.material.dispose();}
