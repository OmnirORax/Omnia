import * as T from 'three';
import { TEXT_DEFAULTS, fontFamily, type Paint } from '../properties/visual.ts';
import { drawEmboldenedText } from '../properties/embolden.ts';
import { isImportedFont } from '../properties/importedFont.ts';
import { translucentOpacity } from '../properties/translucency.ts';
export function label(caption: string, paint?: Paint) {
  const style={...TEXT_DEFAULTS,...paint},font=`32px ${fontFamily(style.font)}`;
  const canvas = document.createElement('canvas'), lines = caption.match(/.{1,28}(?:\s|$)|.{1,28}/gu) ?? ['•'];
  const context = canvas.getContext('2d')!; context.font = font;
  canvas.width = Math.max(64, Math.ceil(Math.max(...lines.map(line => context.measureText(line.trim()).width))) + 24); canvas.height = Math.max(80, lines.length * 48 + 24);
  function draw() {
    context.font = font;context.textAlign = 'center'; context.textBaseline = 'middle';
    context.clearRect(0,0,canvas.width,canvas.height);
    context.fillStyle = style.color; context.shadowColor = style.glow?style.color:'#101113'; context.shadowBlur = style.glow?style.glow*16:8;
    lines.forEach((line, i) => drawEmboldenedText(context, line.trim(), canvas.width / 2, 36 + i * 48, style.embolden, 32));
  }
  draw();
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
  texture.generateMipmaps = true; texture.minFilter = T.LinearMipmapLinearFilter; texture.magFilter = T.LinearFilter;
  const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, opacity:translucentOpacity(1,style.translucency),transparent: true, depthWrite: false })); sprite.scale.set(canvas.width / 52, canvas.height / 52, 1); sprite.userData.aspect = canvas.width / canvas.height;
  if(style.font==='electric'||isImportedFont(style.font))void document.fonts.load(font).then(()=>{
    if(sprite.userData.disposed)return;
    const previousWidth=canvas.width;context.font=font;canvas.width=Math.max(64,Math.ceil(Math.max(...lines.map(line=>context.measureText(line.trim()).width)))+24);
    draw();texture.needsUpdate=true;sprite.scale.x*=canvas.width/previousWidth;sprite.userData.aspect=canvas.width/canvas.height;
    sprite.userData.requestRender?.();
  });
  return sprite;
}
export function disposeLabel(text: T.Sprite) { text.userData.disposed=true;text.material.map?.dispose(); text.material.dispose(); }
