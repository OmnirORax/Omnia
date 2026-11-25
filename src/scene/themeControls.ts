import {configureAutoColors,autoColorKey} from './autoColors.ts';
import {locate,type World,type Origin} from '../core/model.ts';
import {PALETTE_COLOR_LIMIT,migratePaletteSettings,type PaletteSettings} from '../properties/textPalette.ts';
export function themeSettings(world:World,origin?:Origin){return world.appearance?.imageColors?.[autoColorKey(origin)]?.palette??{};}
function validTarget(world:World,origin?:Origin){if(origin&&!locate(world,origin))throw Error('Theme destination no longer exists.');}
export function setThemeInclusions(world:World,origin:Origin|undefined,colors:readonly string[]){validTarget(world,origin);const included=[...new Set(colors.map(c=>c.toLowerCase()))];if(included.length>PALETTE_COLOR_LIMIT||included.some(c=>!/^#[\da-f]{6}$/i.test(c)))throw Error('Too many included colors.');configureAutoColors(world,origin,true,true,{included:included.length?included:undefined,motifOverrides:undefined});}
/** Settings edits retain the chosen membership and retire old layout deltas. */
export function focusTheme(current:PaletteSettings,delta:PaletteSettings):PaletteSettings{const next={...current,distribution:current.distribution??'image',ink:current.ink??'color',...delta,pattern:undefined,layout:undefined,spread:undefined,match:undefined,balance:undefined,softness:undefined,seed:undefined};migratePaletteSettings(next);return next;}
export function setThemeFocus(world:World,origin:Origin|undefined,delta:PaletteSettings){validTarget(world,origin);configureAutoColors(world,origin,true,false,focusTheme(themeSettings(world,origin),delta));}
export function setMotifMembership(world:World,origin:Origin|undefined,id:string,selection:boolean|'only',candidates:readonly {id:string;enabled:boolean}[]){
 const motifOverrides={...themeSettings(world,origin).motifOverrides};
 if(selection==='only'){
  if(!candidates.some(candidate=>candidate.id===id))return;
  for(const candidate of candidates)motifOverrides[candidate.id]=candidate.id===id;
 }else{
  if(!candidates.some(candidate=>candidate.id===id?selection:candidate.enabled))throw Error('Keep at least one motif color.');
  motifOverrides[id]=selection;
 }
 setThemeFocus(world,origin,{motifOverrides});
}
