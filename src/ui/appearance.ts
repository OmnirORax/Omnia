import {createPalettePaint} from './palettePaint.ts';
import {setTextPaint} from '../properties/textPaint.ts';
import {textGlowShadow} from '../properties/textGlow.ts';
import {UI_BORDER_SELECTOR,UI_SURFACE_SELECTOR,UI_DECORATION} from '../composer/runtime/appearance/registry.ts';
import { BACKGROUND_DEFAULTS, renderedTextPaint, fontFamily,fontSizeScale, paintColor, type Appearance, type Paint } from '../properties/visual.ts';
import { emboldenStrokeEm } from '../properties/embolden.ts';

export function setDOMTextPaint(target:{color:string;fontFamily:string;textShadow:string},paint:Paint={}){
 const value=setTextPaint({setColor:color=>{target.color=paintColor({color});},setGlow:(color,strength,spread)=>{target.textShadow=textGlowShadow(strength,paintColor({color}),spread);}},paint);
 target.fontFamily=fontFamily(value.font);return value;
}
export function textStyle(paint?:Paint){const style={color:'',fontFamily:'',textShadow:''};setDOMTextPaint(style,paint);return style;}

export function textBorderStyle(paint:Paint={}){const value=renderedTextPaint(paint),halo=textGlowShadow(value.glow,value.glowColor,value.glowSpread);return {borderColor:value.color,boxShadow:halo==='none'?'var(--omnium-custom-shadow,0 0 0 transparent)':`var(--omnium-custom-shadow,0 0 0 transparent),${halo}`};}
const scrollbarCSS=`
:root[data-visual-text],:root[data-visual-text] *{scrollbar-color:var(--document-text-color,var(--visual-text-color)) transparent !important}
@supports selector(::-webkit-scrollbar){
 :root[data-visual-text],:root[data-visual-text] *{scrollbar-color:auto !important}
 :root[data-visual-text] ::-webkit-scrollbar{width:12px;height:12px;background:transparent}
 :root[data-visual-text] ::-webkit-scrollbar-track,:root[data-visual-text] ::-webkit-scrollbar-corner,:root[data-visual-text] ::-webkit-scrollbar-button{background:transparent}
 :root[data-visual-text] ::-webkit-scrollbar-thumb{background:var(--document-text-color,var(--visual-text-color));box-shadow:var(--document-text-shadow,var(--visual-text-textShadow));border-radius:6px}
}`;
let palettePaint:ReturnType<typeof createPalettePaint>|undefined;
let previous='',borderStyle:HTMLStyleElement|undefined;
export function updateUIAppearance(appearance?: Appearance) {
  const next=JSON.stringify(appearance??{});if(next===previous)return;previous=next;
  if(!borderStyle){borderStyle=document.createElement('style');borderStyle.dataset.textBorderPaint='';borderStyle.textContent=`:root[data-visual-text] :is(${UI_BORDER_SELECTOR}):not(.panel-edge){border-color:${UI_DECORATION.color} !important;box-shadow:${UI_DECORATION.shadow} !important}:root[data-visual-text] :is(${UI_SURFACE_SELECTOR}):not(.panel-edge){box-shadow:${UI_DECORATION.shadow} !important}:root[data-visual-text][data-focus-theme] :is(${UI_BORDER_SELECTOR}):where(.panel),:root[data-visual-text] :is(${UI_BORDER_SELECTOR}):where(.panel[data-focus-theme]){border-color:transparent !important}${scrollbarCSS}`;document.head.append(borderStyle);}
  const root=document.documentElement.style;
  document.documentElement.toggleAttribute('data-visual-text',true);
  document.documentElement.toggleAttribute('data-visual-background',!!appearance?.background);
  const text=appearance?.text;(palettePaint??=createPalettePaint(document.documentElement)).render({...text,glow:0});
  root.setProperty('--visual-text-scale',String(fontSizeScale(text)));
  root.setProperty('--visual-text-bold-stroke',`${emboldenStrokeEm(text?.embolden ?? 0)}em currentColor`);
  for(const [name,value] of Object.entries(textStyle(text))) {
    root.setProperty(`--visual-text-${name}`,value);
  }
  const border=textBorderStyle(text);root.setProperty('--visual-text-border-color',border.borderColor);root.setProperty('--visual-text-border-shadow',border.boxShadow);
  const background=appearance?.background;
  const paint={...BACKGROUND_DEFAULTS,...background};
  root.setProperty('--visual-background',background?paintColor(paint):'');
}
