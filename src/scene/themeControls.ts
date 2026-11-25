import {configureAutoColors,autoColorKey} from './autoColors.ts';
import {locate,type World,type Origin} from '../core/model.ts';
import {migratePaletteSettings,type PaletteSettings} from '../properties/textPalette.ts';
export function themeSettings(world:World,origin?:Origin){return world.appearance?.imageColors?.[autoColorKey(origin)]?.palette??{};}
function validTarget(world:World,origin?:Origin){if(origin&&!locate(world,origin))throw Error('Theme destination no longer exists.');}
export function setThemeInclusions(world:World,origin:Origin|undefined,colors:readonly string[]){validTarget(world,origin);const included=[...new Set(colors.map(c=>c.toLowerCase()))];if(included.length>8||included.some(c=>!/^#[\da-f]{6}$/i.test(c)))throw Error('Choose up to eight included colors.');configureAutoColors(world,origin,true,true,{included:included.length?included:undefined,motifOverrides:undefined});}
/** Settings edits retain the chosen membership and retire old layout deltas. */
export function focusTheme(current:PaletteSettings,delta:PaletteSettings):PaletteSettings{const next={...current,distribution:current.distribution??'image',ink:current.ink??'color',...delta,pattern:undefined,layout:undefined,spread:undefined,match:undefined,balance:undefined,softness:undefined,seed:undefined};migratePaletteSettings(next);return next;}
export function setThemeFocus(world:World,origin:Origin|undefined,delta:PaletteSettings){validTarget(world,origin);configureAutoColors(world,origin,true,false,focusTheme(themeSettings(world,origin),delta));}
export function setMotifMembership(world:World,origin:Origin|undefined,id:string,enabled:boolean,candidates:readonly {id:string;enabled:boolean}[]){const count=candidates.filter(c=>c.id===id?enabled:c.enabled).length;if(count<1||count>8)throw Error(count<1?'Keep at least one motif color.':'Choose up to eight motif colors.');setThemeFocus(world,origin,{motifOverrides:{...themeSettings(world,origin).motifOverrides,[id]:enabled}});}
