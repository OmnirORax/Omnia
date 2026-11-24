import {extractScenePalette,paletteHex,paletteRGB,type ScenePalette} from './palette.ts';
import {paletteInk,type PaletteSettings} from '../properties/textPalette.ts';
import {writePaint} from '../core/appearance.ts';
import type {World,Origin} from '../core/model.ts';
export type ImageColorCombo={text:string;textGlow:string;node:string;nodeGlow:string;textPalette:string[];textWeights:number[];source:ScenePalette};
const vivid=(color:string)=>{const rgb=paletteRGB(color),lo=Math.min(...rgb),span=Math.max(...rgb)-lo;return span?paletteHex(rgb.map(c=>255*(c-lo)/span)):'#ffffff';};
/** Rank defining chromatic accents separately from broad, weakly tinted scenery. */
export function imageTextPalette(palette:ScenePalette,settings:PaletteSettings={}){
 const ranked=palette.accents.map(c=>({...c,score:c.salience??Math.sqrt(c.weight)*((Math.max(...paletteRGB(c.color))-Math.min(...paletteRGB(c.color)))/255)**4})).sort((a,b)=>b.score-a.score),best=ranked[0]?.score??0;
 const selected=settings.match==='palette'?ranked.filter(c=>c.weight>=.025):ranked.filter(c=>c.score>=best*.25&&c.score>0).slice(0,settings.match==='light'||settings.match==='dark'?1:3);
 const stops=selected.map(c=>({textGlow:vivid(c.color),weight:settings.match==='palette'?c.weight:c.score}));
 const white=palette.neutrals.filter(c=>Math.max(...paletteRGB(c.color))>=160).reduce((sum,c)=>sum+c.weight,0),black=palette.neutrals.filter(c=>Math.max(...paletteRGB(c.color))<64).reduce((sum,c)=>sum+c.weight,0);
 const neutral=settings.match==='dark'?'#000000':settings.match==='light'?'#ffffff':black>white*2&&black>=.1?'#000000':white>.025?'#ffffff':undefined;
 if(neutral)stops.push({textGlow:neutral,weight:stops.reduce((sum,c)=>sum+c.weight,0)*.3||1});
 if(!stops.length)stops.push({textGlow:'#ffffff',weight:1});const total=stops.reduce((sum,c)=>sum+c.weight,0),ink=paletteInk(settings);
 return stops.slice(0,8).map(c=>({...c,weight:c.weight/total,text:paletteHex(paletteRGB(c.textGlow).map(v=>255*(1-ink)+v*ink))}));
}
export function matchedImageColors(combo:ImageColorCombo,settings:PaletteSettings={}){
 const palette=imageTextPalette(combo.source,settings),first=palette[0];return {...combo,text:first.text,textGlow:first.textGlow,textPalette:palette.map(c=>c.textGlow),textWeights:palette.map(c=>c.weight),node:first.textGlow,nodeGlow:first.textGlow};
}
export function imageColorCombo(pixels:Uint8ClampedArray):ImageColorCombo{
 const source=extractScenePalette(pixels);if(!source.accents.length&&!source.neutrals.length)throw Error('Image has no visible colours.');
 return matchedImageColors({source,text:'',textGlow:'',node:'',nodeGlow:'',textPalette:[],textWeights:[]});
}
export function applyImageColorCombo(world:World,combo:ImageColorCombo,origin?:Origin){writePaint(world,origin?'nodeText':'text',origin?[origin]:[],{color:combo.text,glowColor:combo.textGlow,palette:{mode:'text',colors:combo.textPalette,weights:combo.textWeights}});writePaint(world,origin?'nodes':'nodeDefaults',origin?[origin]:[],{color:combo.node,glowColor:combo.nodeGlow});}
