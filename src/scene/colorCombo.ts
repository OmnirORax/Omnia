import {extractScenePalette,paletteHex,paletteRGB,colorLuminance,colorHue,type ScenePalette,type SceneTones} from './palette.ts';
import {imageRatio} from '../properties/focusPalette.ts';
import {paletteInk,type PaletteSettings} from '../properties/textPalette.ts';
import {writePaint} from '../core/appearance.ts';
import type {World,Origin} from '../core/model.ts';
export type ImageColorCombo={text:string;textGlow:string;node:string;nodeGlow:string;textPalette:string[];textWeights:number[];textStrength:number;textDarkSupport:boolean;textAvailable?:number;textRatio?:number[];source:ScenePalette};
const vivid=(color:string,boost:boolean|number)=>{const rgb=paletteRGB(color),hi=Math.max(...rgb),lo=Math.min(...rgb),span=hi-lo;if(!hi)return '#ffffff';const saturation=typeof boost==='number'?boost:boost?Math.max(.85,span/hi):span/hi;return paletteHex(rgb.map(c=>span?255*(1-saturation+saturation*(c-lo)/span):255));};
const contrast=(a:number,b:number)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
/** Adjust only the failing accent, rather than bleaching every other motif color. */
function readableAccent(color:string,ink:number,tones:SceneTones){if(ink<1)return color;const rgb=paletteRGB(color),passes=(c:number[])=>{const light=colorLuminance(c.map(v=>255*(1-ink)+v*ink));return contrast(light,tones.background)>=4.5||tones.darkSupport&&Math.max(contrast(light,tones.low),contrast(light,tones.high))>=4.5;};if(passes(rgb))return color;const target=passes([255,255,255])?255:passes([0,0,0])?0:undefined;if(target===undefined)return color;let low=0,high=1;for(let i=0;i<12;i++){const mid=(low+high)/2;if(passes(rgb.map(v=>v+(target-v)*mid)))high=mid;else low=mid;}return paletteHex(rgb.map(v=>v+(target-v)*high));}
/** Assign sampled coverage to included hue families, without making every swatch equally common. */
function includedPalette(palette:ScenePalette,included:readonly string[]){
 const colors=included.map(color=>({color,meanColor:color,weight:0,salience:0}));
 const traits=(color:string)=>{const rgb=paletteRGB(color),hi=Math.max(...rgb),lo=Math.min(...rgb);return {hue:colorHue(rgb),tone:hi/255,chroma:hi>=24&&(hi-lo)/hi>=.18};};
 const targets=colors.map(c=>traits(c.color));
 for(const source of [...palette.accents,...palette.neutrals]){const value=traits(source.color),distances=targets.map(t=>t.chroma!==value.chroma?2+Math.abs(t.tone-value.tone):t.chroma?Math.min(Math.abs(t.hue-value.hue),360-Math.abs(t.hue-value.hue))/180:Math.abs(t.tone-value.tone)),index=distances.indexOf(Math.min(...distances));colors[index].weight+=source.weight;colors[index].salience+=source.salience??source.weight;}
 for(const c of colors){c.weight=Math.max(1/4096,c.weight);c.salience=Math.max(1/4096,c.salience);}return colors;
}
/** Rank defining chromatic accents separately from broad, weakly tinted scenery. */
export function imageTextPalette(palette:ScenePalette,settings:PaletteSettings={}){
 const included=settings.included?.length?settings.included:undefined,allowed=included?(settings.distribution?includedPalette(palette,included):included.map(color=>({color,meanColor:color,weight:1/included.length,salience:1/included.length}))):undefined,chromatic=allowed?.filter(c=>{const rgb=paletteRGB(c.color);return Math.max(...rgb)!==Math.min(...rgb);}),candidates=allowed?(chromatic!.length?chromatic!:allowed):palette.accents;
 const ranked=candidates.map(c=>{const rgb=paletteRGB(c.meanColor??c.color),hi=Math.max(...rgb),sat=hi?(hi-Math.min(...rgb))/hi:0;return {...c,score:allowed?1:(c.salience??Math.sqrt(c.weight)*sat**1.5)*sat**(4*Math.min(1,c.weight*2))};}).sort((a,b)=>b.score-a.score),best=ranked[0]?.score??0,totalChroma=ranked.reduce((sum,c)=>sum+c.weight,0),diversity=Math.exp(-ranked.reduce((sum,c)=>{const share=c.weight/Math.max(.000001,totalChroma);return sum+share*Math.log(share);},0)),cutoff=best*(.04+.21*((diversity-1)/7)**2);
 const focus=settings.distribution!==undefined;
 let selected=allowed?ranked.slice(0,8):settings.match==='palette'?ranked.filter(c=>c.weight>=.025):ranked.filter(c=>c.score>=cutoff&&c.score>0).slice(0,8);
 if(focus){const all=allowed?allowed.map(c=>({...c,score:c.salience})):[...ranked,...palette.neutrals.filter(c=>c.weight>=.025).map(c=>({...c,score:c.weight}))];selected=settings.selection==='top'?[...all].sort((a,b)=>b.weight-a.weight):[...all].sort((a,b)=>b.score-a.score);if(settings.selection!=='top')selected=selected.filter(c=>c.score>=cutoff&&c.score>0);selected=selected.slice(0,8);if(settings.selection==='top'||settings.selection==='top-motif')selected=selected.slice(0,settings.top??2);}
 if(selected.length){const lead=selected[0],hue=(c:typeof lead)=>colorHue(paletteRGB(c.color)),distance=(c:typeof lead)=>{const d=Math.abs(hue(c)-hue(lead));return Math.min(d,360-d);},contrast=[...selected.slice(1)].sort((a,b)=>distance(b)-distance(a))[0]??lead;
  if(settings.selection==='primary')selected=[lead];else if(settings.selection==='contrast')selected=[contrast];else if(settings.selection==='rare')selected=[[...selected].sort((a,b)=>a.weight-b.weight)[0]];else if(settings.selection==='pair')selected=contrast===lead?[lead]:[lead,contrast];
 }
 let seed=settings.seed??1;seed=Math.imul(seed^(seed>>>16),0x45d9f3b);seed=Math.imul(seed^(seed>>>16),0x45d9f3b);seed=(seed^(seed>>>16))>>>0;const saturation=settings.saturation??(settings.pattern==='generated'?.4+.6*seed/4294967296:settings.ink==='color'),tones=palette.tones,ink=paletteInk(settings),stops=selected.map(c=>({textGlow:readableAccent(Math.max(...paletteRGB(c.color))===Math.min(...paletteRGB(c.color))?c.color:vivid(c.color,saturation),ink,tones),weight:focus||settings.match==='palette'?c.weight:Math.sqrt(c.score)}));
 const white=palette.neutrals.filter(c=>Math.max(...paletteRGB(c.color))>=160).reduce((sum,c)=>sum+c.weight,0);
 const may=(color:string)=>!included||included.some(c=>c.toLowerCase()===color);
 const neutral=settings.match==='dark'?'#000000':settings.match==='light'?'#ffffff':settings.match==='accents'?undefined:white>.025?'#ffffff':undefined;
 if(!focus&&neutral&&may(neutral)&&stops.length<8)stops.push({textGlow:readableAccent(neutral,ink,tones),weight:stops.reduce((sum,c)=>sum+c.weight,0)*.3||1});
 if(!focus&&(included?may('#000000'):tones.darkSupport)&&settings.match!=='light'&&settings.match!=='dark'&&settings.match!=='accents'&&stops.length<8)stops.push({textGlow:readableAccent('#000000',ink,tones),weight:stops.reduce((sum,c)=>sum+c.weight,0)*.3||1});
 if(!focus&&allowed&&settings.selection!=='primary'&&settings.selection!=='contrast'&&settings.selection!=='rare'&&settings.match==='motif')for(const c of allowed.filter(c=>{const rgb=paletteRGB(c.color);return Math.max(...rgb)===Math.min(...rgb);}))if(stops.length<8&&!stops.some(s=>s.textGlow.toLowerCase()===c.color.toLowerCase()))stops.push({textGlow:c.color,weight:1});
 if(!stops.length)stops.push({textGlow:'#ffffff',weight:1});if(!focus&&settings.balance!==undefined&&stops.length>1){const remainder=stops.slice(1).reduce((n,c)=>n+c.weight,0);stops[0].weight=settings.balance;for(const c of stops.slice(1))c.weight=(1-settings.balance)*c.weight/remainder;}const total=stops.reduce((sum,c)=>sum+c.weight,0);
 return stops.slice(0,8).map(c=>({...c,strength:ink,darkSupport:included?may('#000000'):tones.darkSupport,weight:c.weight/total,text:paletteHex(paletteRGB(c.textGlow).map(v=>255*(1-ink)+v*ink))}));
}
export function matchedImageColors(combo:ImageColorCombo,settings:PaletteSettings={}){
 const palette=imageTextPalette(combo.source,settings),first=palette[0],available=imageTextPalette(combo.source,{...settings,selection:settings.selection==='top'?'top':'top-motif',top:8}).length;return {...combo,text:first.text,textGlow:first.textGlow,textPalette:palette.map(c=>c.textGlow),textWeights:palette.map(c=>c.weight),textStrength:first.strength,textDarkSupport:first.darkSupport,textAvailable:available,textRatio:imageRatio(palette.map(c=>c.weight)),node:first.textGlow,nodeGlow:first.textGlow};
}
export function imageColorCombo(pixels:Uint8ClampedArray):ImageColorCombo{
 const source=extractScenePalette(pixels);if(!source.accents.length&&!source.neutrals.length)throw Error('Image has no visible colours.');
 return matchedImageColors({source,text:'',textGlow:'',node:'',nodeGlow:'',textPalette:[],textWeights:[],textStrength:1,textDarkSupport:false});
}
export const comboPalette=(combo:ImageColorCombo,settings?:PaletteSettings)=>({...Object.fromEntries(Object.entries(settings??{}).filter(([,value])=>value!==undefined)) as PaletteSettings,mode:'text' as const,colors:combo.textPalette,weights:combo.textWeights,strength:combo.textStrength,darkSupport:combo.textDarkSupport,available:combo.textAvailable,imageRatio:combo.textRatio});
export function applyImageColorCombo(world:World,combo:ImageColorCombo,origin?:Origin){writePaint(world,origin?'nodeText':'text',origin?[origin]:[],{color:combo.text,glowColor:combo.textGlow,palette:comboPalette(combo)});writePaint(world,origin?'nodes':'nodeDefaults',origin?[origin]:[],{color:combo.node,glowColor:combo.nodeGlow});}
