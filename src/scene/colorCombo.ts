import {extractScenePalette,paletteHex,paletteRGB,colorLuminance,colorHue,type ScenePalette,type SceneTones} from './palette.ts';
import {paletteInk,type PaletteSettings} from '../properties/textPalette.ts';
import {writePaint} from '../core/appearance.ts';
import type {World,Origin} from '../core/model.ts';
export type ImageColorCombo={text:string;textGlow:string;node:string;nodeGlow:string;textPalette:string[];textWeights:number[];textStrength:number;textDarkSupport:boolean;source:ScenePalette};
const vivid=(color:string,boost:boolean|number)=>{const rgb=paletteRGB(color),hi=Math.max(...rgb),lo=Math.min(...rgb),span=hi-lo;if(!hi)return '#ffffff';const saturation=typeof boost==='number'?boost:boost?Math.max(.85,span/hi):span/hi;return paletteHex(rgb.map(c=>span?255*(1-saturation+saturation*(c-lo)/span):255));};
const contrast=(a:number,b:number)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
/** Adjust only the failing accent, rather than bleaching every other motif color. */
function readableAccent(color:string,ink:number,tones:SceneTones){if(ink<1)return color;const rgb=paletteRGB(color),passes=(c:number[])=>{const light=colorLuminance(c.map(v=>255*(1-ink)+v*ink));return contrast(light,tones.background)>=4.5||tones.darkSupport&&Math.max(contrast(light,tones.low),contrast(light,tones.high))>=4.5;};if(passes(rgb))return color;const target=passes([255,255,255])?255:passes([0,0,0])?0:undefined;if(target===undefined)return color;let low=0,high=1;for(let i=0;i<12;i++){const mid=(low+high)/2;if(passes(rgb.map(v=>v+(target-v)*mid)))high=mid;else low=mid;}return paletteHex(rgb.map(v=>v+(target-v)*high));}
/** Rank defining chromatic accents separately from broad, weakly tinted scenery. */
export function imageTextPalette(palette:ScenePalette,settings:PaletteSettings={}){
 const ranked=palette.accents.map(c=>{const rgb=paletteRGB(c.meanColor??c.color),hi=Math.max(...rgb),sat=hi?(hi-Math.min(...rgb))/hi:0;return {...c,score:(c.salience??Math.sqrt(c.weight)*sat**1.5)*sat**(4*Math.min(1,c.weight*2))};}).sort((a,b)=>b.score-a.score),best=ranked[0]?.score??0,totalChroma=ranked.reduce((sum,c)=>sum+c.weight,0),diversity=Math.exp(-ranked.reduce((sum,c)=>{const share=c.weight/Math.max(.000001,totalChroma);return sum+share*Math.log(share);},0)),cutoff=best*(.04+.21*((diversity-1)/7)**2);
 let selected=settings.match==='palette'?ranked.filter(c=>c.weight>=.025):ranked.filter(c=>c.score>=cutoff&&c.score>0).slice(0,8);
 if(selected.length){const lead=selected[0],hue=(c:typeof lead)=>colorHue(paletteRGB(c.color)),distance=(c:typeof lead)=>{const d=Math.abs(hue(c)-hue(lead));return Math.min(d,360-d);},contrast=[...selected.slice(1)].sort((a,b)=>distance(b)-distance(a))[0]??lead;
  if(settings.selection==='primary')selected=[lead];else if(settings.selection==='contrast')selected=[contrast];else if(settings.selection==='rare')selected=[[...selected].sort((a,b)=>a.weight-b.weight)[0]];else if(settings.selection==='pair')selected=contrast===lead?[lead]:[lead,contrast];
 }
 let seed=settings.seed??1;seed=Math.imul(seed^(seed>>>16),0x45d9f3b);seed=Math.imul(seed^(seed>>>16),0x45d9f3b);seed=(seed^(seed>>>16))>>>0;const saturation=settings.saturation??(settings.pattern==='generated'?.4+.6*seed/4294967296:settings.ink==='color'),tones=palette.tones,ink=paletteInk(settings),stops=selected.map(c=>({textGlow:readableAccent(vivid(c.color,saturation),ink,tones),weight:settings.match==='palette'?c.weight:Math.sqrt(c.score)}));
 const white=palette.neutrals.filter(c=>Math.max(...paletteRGB(c.color))>=160).reduce((sum,c)=>sum+c.weight,0);
 const neutral=settings.match==='dark'?'#000000':settings.match==='light'?'#ffffff':settings.match==='accents'?undefined:white>.025?'#ffffff':undefined;
 if(neutral&&stops.length<8)stops.push({textGlow:readableAccent(neutral,ink,tones),weight:stops.reduce((sum,c)=>sum+c.weight,0)*.3||1});
 if(tones.darkSupport&&settings.match!=='light'&&settings.match!=='dark'&&settings.match!=='accents'&&stops.length<8)stops.push({textGlow:readableAccent('#000000',ink,tones),weight:stops.reduce((sum,c)=>sum+c.weight,0)*.3||1});
 if(!stops.length)stops.push({textGlow:'#ffffff',weight:1});if(settings.balance!==undefined&&stops.length>1){const remainder=stops.slice(1).reduce((n,c)=>n+c.weight,0);stops[0].weight=settings.balance;for(const c of stops.slice(1))c.weight=(1-settings.balance)*c.weight/remainder;}const total=stops.reduce((sum,c)=>sum+c.weight,0);
 return stops.slice(0,8).map(c=>({...c,strength:ink,darkSupport:tones.darkSupport,weight:c.weight/total,text:paletteHex(paletteRGB(c.textGlow).map(v=>255*(1-ink)+v*ink))}));
}
export function matchedImageColors(combo:ImageColorCombo,settings:PaletteSettings={}){
 const palette=imageTextPalette(combo.source,settings),first=palette[0];return {...combo,text:first.text,textGlow:first.textGlow,textPalette:palette.map(c=>c.textGlow),textWeights:palette.map(c=>c.weight),textStrength:first.strength,textDarkSupport:first.darkSupport,node:first.textGlow,nodeGlow:first.textGlow};
}
export function imageColorCombo(pixels:Uint8ClampedArray):ImageColorCombo{
 const source=extractScenePalette(pixels);if(!source.accents.length&&!source.neutrals.length)throw Error('Image has no visible colours.');
 return matchedImageColors({source,text:'',textGlow:'',node:'',nodeGlow:'',textPalette:[],textWeights:[],textStrength:1,textDarkSupport:false});
}
export function applyImageColorCombo(world:World,combo:ImageColorCombo,origin?:Origin){writePaint(world,origin?'nodeText':'text',origin?[origin]:[],{color:combo.text,glowColor:combo.textGlow,palette:{mode:'text',colors:combo.textPalette,weights:combo.textWeights,strength:combo.textStrength,darkSupport:combo.textDarkSupport}});writePaint(world,origin?'nodes':'nodeDefaults',origin?[origin]:[],{color:combo.node,glowColor:combo.nodeGlow});}
