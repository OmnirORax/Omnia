import * as T from 'three';
export function label(caption: string) {
  const canvas = document.createElement('canvas'), lines = caption.match(/.{1,28}(?:\s|$)|.{1,28}/gu) ?? ['•'];
  const context = canvas.getContext('2d')!; context.font = '32px system-ui';
  canvas.width = Math.max(64, Math.ceil(Math.max(...lines.map(line => context.measureText(line.trim()).width))) + 24); canvas.height = Math.max(80, lines.length * 48 + 24);
  context.font = '32px system-ui'; context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillStyle = '#eeeee8'; context.shadowColor = '#101113'; context.shadowBlur = 8;
  lines.forEach((line, i) => context.fillText(line.trim(), canvas.width / 2, 36 + i * 48));
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
  texture.generateMipmaps = true; texture.minFilter = T.LinearMipmapLinearFilter; texture.magFilter = T.LinearFilter;
  const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })); sprite.scale.set(canvas.width / 52, canvas.height / 52, 1); sprite.userData.aspect = canvas.width / canvas.height; return sprite;
}
export function disposeLabel(text: T.Sprite) { text.material.map?.dispose(); text.material.dispose(); }
