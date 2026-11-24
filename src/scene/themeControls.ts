import {configureAutoColors,autoColorKey} from './autoColors.ts';
import {readPaint} from '../core/appearance.ts';
import {locate,type World,type Origin} from '../core/model.ts';
import {randomMacroTheme,randomMicroTheme,generatedTheme,type PaletteSettings} from '../properties/textPalette.ts';
export type ThemeVariation='macro'|'micro'|'generate';
export function themeSettings(world:World,origin?:Origin){return world.appearance?.imageColors?.[autoColorKey(origin)]?.palette??{};}
function validTarget(world:World,origin?:Origin){if(origin&&!locate(world,origin))throw Error('Theme destination no longer exists.');}
export function setThemeInclusions(world:World,origin:Origin|undefined,colors:readonly string[]){validTarget(world,origin);const included=[...new Set(colors.map(c=>c.toLowerCase()))];if(included.length>8||included.some(c=>!/^#[\da-f]{6}$/i.test(c)))throw Error('Choose up to eight included colors.');configureAutoColors(world,origin,true,true,{included:included.length?included:undefined});}
/** Manual focus edits retain hue inclusions and replace the retired layout deltas. */
export function focusTheme(current:PaletteSettings,delta:PaletteSettings):PaletteSettings{return {...current,distribution:current.distribution??'balanced',ink:'color',...(current.selection==='pair'?{selection:'top-motif' as const,top:2}:{}),...delta,pattern:undefined,layout:undefined,spread:undefined,match:undefined,balance:undefined,softness:undefined,seed:undefined};}
export function setThemeFocus(world:World,origin:Origin|undefined,delta:PaletteSettings){validTarget(world,origin);configureAutoColors(world,origin,true,false,focusTheme(themeSettings(world,origin),delta));}
/** Scene controls, picker and keyboard/mouse commands share the same parameter owner. */
export function varyTheme(world:World,origin:Origin|undefined,kind:ThemeVariation){validTarget(world,origin);const current=themeSettings(world,origin),dark=current.included?.length?current.included.some(c=>c.toLowerCase()==='#000000'):readPaint(world,origin?'nodeText':'text',origin).palette?.darkSupport,settings=kind==='macro'?randomMacroTheme(current,dark,current.included):kind==='micro'?randomMicroTheme(current):generatedTheme(current,dark);configureAutoColors(world,origin,true,false,settings);}
