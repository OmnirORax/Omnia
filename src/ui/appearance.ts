import { BACKGROUND_DEFAULTS, TEXT_DEFAULTS, fontFamily, paintColor, type Appearance, type Paint } from '../properties/visual.ts';
import { emboldenStrokeEm } from '../properties/embolden.ts';

export function textStyle(paint?: Paint) {
  const value={...TEXT_DEFAULTS,...paint};
  return {color:paintColor(value),fontFamily:fontFamily(value.font),textShadow:value.glow?`0 0 ${value.glow*10}px ${value.color}`:'none'};
}
let previous='';
export function updateUIAppearance(appearance?: Appearance) {
  const next=JSON.stringify(appearance??{});if(next===previous)return;previous=next;
  const root=document.documentElement.style;
  document.documentElement.toggleAttribute('data-visual-text',!!appearance?.text);
  document.documentElement.toggleAttribute('data-visual-background',!!appearance?.background);
  const text=appearance?.text;
  root.setProperty('--visual-text-bold-stroke',`${emboldenStrokeEm(text?.embolden ?? 0)}em currentColor`);
  for(const [name,value] of Object.entries(text ? textStyle(text) : {color:'',fontFamily:'',textShadow:''})) {
    root.setProperty(`--visual-text-${name}`,value);
  }
  const background=appearance?.background;
  const paint={...BACKGROUND_DEFAULTS,...background};
  root.setProperty('--visual-background',background?paintColor(paint):'');
  root.setProperty('--visual-background-glow',background?`0 0 ${paint.glow*14}px ${paint.color}`:'');
}
