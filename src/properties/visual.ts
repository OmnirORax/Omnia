import {validTextPalette,validPaletteSettings,migratePaletteSettings,retirePaletteRework,type TextPalette} from './textPalette.ts';
import {RETIRED_TEXT_CHANNELS,retireTextChannels} from './textChannels.ts';
export {retireTextChannels} from './textChannels.ts';
import {TEXT_GLOW_MAX,TEXT_GLOW_SPREAD} from './textGlow.ts';
import {validateNodePaint,type NodePaint} from './nodeVisuals.ts';
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
export type Paint = { color?: string; brightness?:number; brightnessEnabled?:boolean; opacity?:number; glowColor?:string; translucency?: number; glow?: number; glowSpread?:number; font?: string; fontName?:string; fontSize?:number; palette?:TextPalette; embolden?: number };
export type PaintField=Exclude<keyof Paint,'palette'>;
export type Appearance = { imageColors?:Record<string,import('../scene/autoColors.ts').AutoColorRule>; text?: Paint; background?: Paint; nodes?: NodePaint };
export const color = property({key:'color',label:'Color',kind:'color'});
export const translucency = property({key:'translucency',label:'Translucency',kind:'number',min:0,max:1,step:.01});
export const glowColor=property({key:'glowColor',label:'Glow color',kind:'color'});
export const textGlow=property({key:'glow',label:'Glow',kind:'number',min:0,max:TEXT_GLOW_MAX,step:.01});
export const glowSpread=property({key:'glowSpread',label:'Glow spread',kind:'number',min:TEXT_GLOW_SPREAD.min,max:TEXT_GLOW_SPREAD.max,step:TEXT_GLOW_SPREAD.step});
export const font = property({key:'font',label:'Font',kind:'select',options:FONT_OPTIONS});
export const FONT_SIZE={min:6,max:72,initial:12} as const;
export const fontSizeScale=(paint:Paint={})=>(paint.fontSize??FONT_SIZE.initial)/FONT_SIZE.initial;
export const fontSize=property({key:'fontSize',label:'Font size',kind:'number',min:FONT_SIZE.min,max:FONT_SIZE.max,step:1,unit:'px'});
export const embolden = property({key:'embolden',label:'Bold strength',kind:'number',min:0,max:10,step:.25});
export const visualProperties = (text: boolean,paint?:Paint) => text ? [color,textGlow,glowSpread,glowColor,embolden,paint?.font&&isImportedFont(paint.font)?{...font,options:[...FONT_OPTIONS,{id:paint.font,label:paint.fontName??'Imported font'}]}:font,fontSize] : [color,translucency];
export const TEXT_DEFAULTS = {color:'#eeeee8',glow:0,glowSpread:TEXT_GLOW_SPREAD.initial,font:'system',fontSize:FONT_SIZE.initial,embolden:0};
export const BACKGROUND_DEFAULTS = {color:'#191c1b',translucency:.04};
export const fontFamily = (id?: string) => (id&&isImportedFont(id)?importedFontFamily(id):FONT_OPTIONS.find(font=>font.id===id)?.family) ?? FONT_OPTIONS[0].family;
export const paintColor = (paint: Paint) => `${paint.color}${Math.round(translucentOpacity(paint.opacity??1,paint.translucency)*255).toString(16).padStart(2,'0')}`;
export function validatePaint(paint: Paint | undefined, text: boolean) {
  if(paint===undefined)return;
  if(text&&paint?.palette&&retirePaletteRework(paint.palette))delete paint.palette;
  if(paint?.palette)migratePaletteSettings(paint.palette);
  if(paint?.palette&&['shuffle','random'].includes(paint.palette.pattern as string)){paint.palette.pattern='smooth';delete paint.palette.seed;}
  if(text&&paint?.palette&&(paint.palette as {mode:string}).mode==='nodes')paint.palette.mode='text';
  if(!paint || typeof paint!=='object' || Array.isArray(paint) ||
    text&&RETIRED_TEXT_CHANNELS.some(key=>paint[key]!==undefined) ||
    !text&&(paint.glow!==undefined||paint.glowColor!==undefined) ||
    paint.color!==undefined&&!/^#[\da-f]{6}$/i.test(paint.color) || paint.glowColor!==undefined&&!/^#[\da-f]{6}$/i.test(paint.glowColor) ||
    ['opacity','translucency'].some(key=>paint[key as 'glow']!==undefined&&(!Number.isFinite(paint[key as 'glow'])||paint[key as 'glow']!<0||paint[key as 'glow']!>1)) ||
    paint.glow!==undefined&&(!Number.isFinite(paint.glow)||paint.glow<0||paint.glow>TEXT_GLOW_MAX) ||
    paint.glowSpread!==undefined&&(!text||!Number.isFinite(paint.glowSpread)||paint.glowSpread<TEXT_GLOW_SPREAD.min||paint.glowSpread>TEXT_GLOW_SPREAD.max) ||
    paint.brightness!==undefined&&(!Number.isFinite(paint.brightness)||paint.brightness<0||paint.brightness>1) ||
    paint.palette!==undefined&&(!text||!validTextPalette(paint.palette)) ||
    paint.fontSize!==undefined&&(!text||!Number.isInteger(paint.fontSize)||paint.fontSize<FONT_SIZE.min||paint.fontSize>FONT_SIZE.max) ||
    paint.fontName!==undefined&&(!text||typeof paint.fontName!=='string'||!paint.fontName.trim()||paint.fontName.length>160) ||
    paint.font!==undefined&&(!text||!FONT_OPTIONS.some(font=>font.id===paint.font)&&!isImportedFont(paint.font)) ||
    paint.embolden!==undefined&&(!text||!Number.isFinite(paint.embolden)||paint.embolden<0||paint.embolden>10))throw Error('Invalid visual properties.');
}
export function validateAppearance(value: Appearance | undefined) {
  if(value===undefined)return;
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid appearance.');
  if(value.imageColors!==undefined){if(!value.imageColors||typeof value.imageColors!=='object'||Array.isArray(value.imageColors)||Object.keys(value.imageColors).length>1000)throw Error('Invalid image colour rules.');for(const [key,rule]of Object.entries(value.imageColors)){if(rule?.palette){retirePaletteRework(rule.palette);migratePaletteSettings(rule.palette);}if(rule?.palette&&['shuffle','random'].includes(rule.palette.pattern as string)){rule.palette.pattern='smooth';delete rule.palette.seed;}if(rule&&(rule as {mode?:string}).mode==='nodes')rule.mode='text';if(key.length>200||!rule||rule.mode!==undefined&&rule.mode!=='text'||rule.palette!==undefined&&(!rule.palette||typeof rule.palette!=='object'||Array.isArray(rule.palette)||!validPaletteSettings(rule.palette))||typeof rule.enabled!=='boolean'||rule.inherit!==undefined&&typeof rule.inherit!=='boolean'||!Array.isArray(rule.manual)||rule.manual.length>4||rule.manual.some(channel=>!['text','textGlow','node','nodeGlow'].includes(channel)))throw Error('Invalid image colour rule.');if(key!=='default'){try{const origin=JSON.parse(key);if(!Number.isFinite(origin.born)||!Array.isArray(origin.at)||origin.at.length!==3||origin.at.some((v:unknown)=>typeof v!=='number'||!Number.isFinite(v)))throw Error();}catch{throw Error('Invalid image colour target.');}}}}
  retireTextChannels(value.text);if(value.background){delete value.background.glow;delete value.background.glowColor;}validatePaint(value.text,true);validatePaint(value.background,false);validateNodePaint(value.nodes);
  delete (value as Appearance&{animations?:unknown}).animations;
}

/** The same resolved text ink is used by DOM and world labels; authored colors stay intact. */
export function resolvedTextPaint(paint:Paint={}){const style={...TEXT_DEFAULTS,...paint};retireTextChannels(style);return {...style,glowColor:style.glowColor??style.color};}
export const renderedTextPaint=resolvedTextPaint;
