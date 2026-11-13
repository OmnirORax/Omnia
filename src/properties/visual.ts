import {isImportedFont,importedFontFamily} from './importedFont.ts';
import { property } from './pool.ts';
import { translucentOpacity } from './translucency.ts';

/** Native font families reused from V1; presentation never changes authored text. */
export const FONT_OPTIONS = [
  { id:'system',label:'System',family:'system-ui, sans-serif' },
  { id:'sans',label:'Sans serif',family:'Arial, Helvetica, sans-serif' },
  { id:'serif',label:'Serif',family:"Georgia, 'Times New Roman', serif" },
  { id:'mono',label:'Monospace',family:'ui-monospace, SFMono-Regular, Consolas, monospace' },
  { id:'electric',label:'Rubik Glitch',family:"'Rubik Glitch', system-ui, sans-serif" },
] as const;
export type Paint = { color?: string; translucency?: number; glow?: number; font?: string; embolden?: number };
export type Appearance = { text?: Paint; background?: Paint };
export const color = property({key:'color',label:'Color',kind:'color'});
export const translucency = property({key:'translucency',label:'Translucency',kind:'number',min:0,max:1,step:.01});
export const glow = property({key:'glow',label:'Glow',kind:'number',min:0,max:1,step:.01});
export const font = property({key:'font',label:'Font',kind:'select',options:FONT_OPTIONS});
export const embolden = property({key:'embolden',label:'Forced boldness',kind:'number',min:0,max:10,step:.25});
export const visualProperties = (text: boolean) => text ? [color,translucency,glow,embolden,font] : [color,translucency,glow];
export const TEXT_DEFAULTS = {color:'#eeeee8',translucency:0,glow:0,font:'system',embolden:0};
export const BACKGROUND_DEFAULTS = {color:'#191c1b',translucency:.04,glow:0};
export const fontFamily = (id?: string) => (id&&isImportedFont(id)?importedFontFamily(id):FONT_OPTIONS.find(font=>font.id===id)?.family) ?? FONT_OPTIONS[0].family;
export const paintColor = (paint: Paint) => `${paint.color}${Math.round(translucentOpacity(1,paint.translucency)*255).toString(16).padStart(2,'0')}`;
export function validatePaint(paint: Paint | undefined, text: boolean) {
  if(paint===undefined)return;
  if(!paint || typeof paint!=='object' || Array.isArray(paint) ||
    paint.color!==undefined&&!/^#[\da-f]{6}$/i.test(paint.color) ||
    ['translucency','glow'].some(key=>paint[key as 'glow']!==undefined&&(!Number.isFinite(paint[key as 'glow'])||paint[key as 'glow']!<0||paint[key as 'glow']!>1)) ||
    paint.font!==undefined&&(!text||!FONT_OPTIONS.some(font=>font.id===paint.font)&&!isImportedFont(paint.font)) ||
    paint.embolden!==undefined&&(!text||!Number.isFinite(paint.embolden)||paint.embolden<0||paint.embolden>10))throw Error('Invalid visual properties.');
}
export function validateAppearance(value: Appearance | undefined) {
  if(value===undefined)return;
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid appearance.');
  validatePaint(value.text,true);validatePaint(value.background,false);
}
