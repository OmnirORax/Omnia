import {TEXT_GLOW_MAX,TEXT_GLOW_SPREAD} from './textGlow.ts';
import {textBrightness} from './textBrightness.ts';
import {validateNodePaint,NODE_VISUAL_PROPERTIES,type NodePaint} from './nodeVisuals.ts';
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
export type Paint = { color?: string; brightness?:number; opacity?:number; glowColor?:string; translucency?: number; glow?: number; glowSpread?:number; font?: string; embolden?: number };
export type Appearance = { text?: Paint; background?: Paint; nodes?: NodePaint };
export const color = property({key:'color',label:'Color',kind:'color'});
export const brightness=property({...NODE_VISUAL_PROPERTIES.find(p=>p.id==='brightness')!,key:'brightness',min:0,max:1,step:.01});
export const opacity=property({...NODE_VISUAL_PROPERTIES.find(p=>p.id==='opacity')!,key:'opacity'});
export const translucency = property({key:'translucency',label:'Translucency',kind:'number',min:0,max:1,step:.01});
export const glowColor=property({key:'glowColor',label:'Glow color',kind:'color'});
export const glow = property({key:'glow',label:'Glow',kind:'number',min:0,max:1,step:.01});
export const textGlow={...glow,max:TEXT_GLOW_MAX};
export const glowSpread=property({key:'glowSpread',label:'Glow spread',kind:'number',presentation:'slider',min:TEXT_GLOW_SPREAD.min,max:TEXT_GLOW_SPREAD.max,step:TEXT_GLOW_SPREAD.step});
export const font = property({key:'font',label:'Font',kind:'select',options:FONT_OPTIONS});
export const embolden = property({key:'embolden',label:'Bold strength',kind:'number',presentation:'slider',min:0,max:10,step:.25});
export const visualProperties = (text: boolean) => text ? [color,brightness,opacity,translucency,textGlow,glowSpread,glowColor,embolden,font] : [color,translucency,glow,glowColor];
export const TEXT_DEFAULTS = {color:'#eeeee8',brightness:.5,opacity:1,translucency:0,glow:0,glowSpread:TEXT_GLOW_SPREAD.initial,font:'system',embolden:0};
export const BACKGROUND_DEFAULTS = {color:'#191c1b',translucency:.04,glow:0};
export const fontFamily = (id?: string) => (id&&isImportedFont(id)?importedFontFamily(id):FONT_OPTIONS.find(font=>font.id===id)?.family) ?? FONT_OPTIONS[0].family;
export const paintColor = (paint: Paint) => `${paint.color}${Math.round(translucentOpacity(paint.opacity??1,paint.translucency)*255).toString(16).padStart(2,'0')}`;
export function validatePaint(paint: Paint | undefined, text: boolean) {
  if(paint===undefined)return;
  if(!paint || typeof paint!=='object' || Array.isArray(paint) ||
    paint.color!==undefined&&!/^#[\da-f]{6}$/i.test(paint.color) || paint.glowColor!==undefined&&!/^#[\da-f]{6}$/i.test(paint.glowColor) ||
    ['opacity','translucency'].some(key=>paint[key as 'glow']!==undefined&&(!Number.isFinite(paint[key as 'glow'])||paint[key as 'glow']!<0||paint[key as 'glow']!>1)) ||
    paint.glow!==undefined&&(!Number.isFinite(paint.glow)||paint.glow<0||paint.glow>(text?TEXT_GLOW_MAX:glow.max!)) ||
    paint.glowSpread!==undefined&&(!text||!Number.isFinite(paint.glowSpread)||paint.glowSpread<TEXT_GLOW_SPREAD.min||paint.glowSpread>TEXT_GLOW_SPREAD.max) ||
    paint.brightness!==undefined&&(!Number.isFinite(paint.brightness)||paint.brightness<0||paint.brightness>1) ||
    paint.font!==undefined&&(!text||!FONT_OPTIONS.some(font=>font.id===paint.font)&&!isImportedFont(paint.font)) ||
    paint.embolden!==undefined&&(!text||!Number.isFinite(paint.embolden)||paint.embolden<0||paint.embolden>10))throw Error('Invalid visual properties.');
}
export function validateAppearance(value: Appearance | undefined) {
  if(value===undefined)return;
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid appearance.');
  normalizeLegacyTextBrightness(value.text);validatePaint(value.text,true);validatePaint(value.background,false);validateNodePaint(value.nodes);
  delete (value as Appearance&{animations?:unknown}).animations;
}

/** The same resolved text ink is used by DOM and world labels; authored colors stay intact. */
export function renderedTextPaint(paint:Paint={}){const style={...TEXT_DEFAULTS,...paint};return {...style,color:textBrightness(style.color,style.brightness),glowColor:textBrightness(style.glowColor??style.color,style.brightness)};}

/** Retire out-of-domain values from the former 0–3 text control without invalidating old saves. */
export function normalizeLegacyTextBrightness(paint:Paint|undefined){if(paint&&typeof paint.brightness==='number'&&paint.brightness>1&&paint.brightness<=3)paint.brightness=1;}
