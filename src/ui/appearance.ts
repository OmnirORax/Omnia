import {textGlowShadow} from '../properties/textGlow.ts';
import {UI_BORDER_SELECTOR} from '../composer/runtime/appearance/registry.ts';
import { BACKGROUND_DEFAULTS, renderedTextPaint, fontFamily, paintColor, type Appearance, type Paint } from '../properties/visual.ts';
import { emboldenStrokeEm } from '../properties/embolden.ts';

export function textStyle(paint?: Paint) {
  const value=renderedTextPaint(paint);
  return {color:paintColor(value),fontFamily:fontFamily(value.font),textShadow:textGlowShadow(value.glow,paintColor({...value,color:value.glowColor??value.color}))};
}
export function textBorderStyle(paint:Paint={}){const value=renderedTextPaint(paint),border={...value,translucency:0},color=value.opacity===1?value.color:paintColor(border),halo=value.opacity===1?value.glowColor:paintColor({...border,color:value.glowColor});return {borderColor:color,boxShadow:value.glow?`var(--omnium-custom-shadow,0 0 0 transparent),0 0 ${value.glow*14}px ${halo}`:'var(--omnium-custom-shadow,0 0 0 transparent)'};}
let previous='',borderStyle:HTMLStyleElement|undefined;
export function updateUIAppearance(appearance?: Appearance) {
  const next=JSON.stringify(appearance??{});if(next===previous)return;previous=next;
  if(!borderStyle){borderStyle=document.createElement('style');borderStyle.dataset.textBorderPaint='';borderStyle.textContent=`:root[data-visual-text] :is(${UI_BORDER_SELECTOR}){border-color:var(--visual-text-border-color);box-shadow:var(--visual-text-border-shadow)}`;document.head.append(borderStyle);}
  const root=document.documentElement.style;
  document.documentElement.toggleAttribute('data-visual-text',!!appearance?.text);
  document.documentElement.toggleAttribute('data-visual-background',!!appearance?.background);
  const text=appearance?.text;
  root.setProperty('--visual-text-bold-stroke',`${emboldenStrokeEm(text?.embolden ?? 0)}em currentColor`);
  for(const [name,value] of Object.entries(text ? textStyle(text) : {color:'',fontFamily:'',textShadow:''})) {
    root.setProperty(`--visual-text-${name}`,value);
  }
  const border=textBorderStyle(text);root.setProperty('--visual-text-border-color',border.borderColor);root.setProperty('--visual-text-border-shadow',border.boxShadow);
  const background=appearance?.background;
  const paint={...BACKGROUND_DEFAULTS,...background};
  root.setProperty('--visual-background',background?paintColor(paint):'');
  root.setProperty('--visual-background-glow',background?`0 0 ${paint.glow*14}px ${paint.glowColor??paint.color}`:'');
}
