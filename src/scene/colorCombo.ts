import {extractScenePalette,paletteHex,paletteRGB,colorLuminance,colorHue,paletteFamily,type SceneSignal,type ScenePalette,type SceneTones} from './palette.ts';
import {imageRatio} from '../properties/focusPalette.ts';
import {paletteInk,type PaletteSettings} from '../properties/textPalette.ts';
import {writePaint} from '../core/appearance.ts';
import type {World,Origin} from '../core/model.ts';
export type ImageColorCombo={text:string;textGlow:string;node:string;nodeGlow:string;textPalette:string[];textWeights:number[];textStrength:number;textDarkSupport:boolean;textAvailable?:number;textRatio?:number[];source:ScenePalette};
const vivid=(color:string,boost:boolean|number)=>{const rgb=paletteRGB(color),hi=Math.max(...rgb),lo=Math.min(...rgb),span=hi-lo;if(!hi)return '#ffffff';const saturation=typeof boost==='number'?boost:boost?Math.max(.85,span/hi):span/hi;return paletteHex(rgb.map(c=>span?255*(1-saturation+saturation*(c-lo)/span):255));};
const contrast=(a:number,b:number)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
/** Adjust only the failing accent, rather than bleaching every other motif color. */
function readableAccent(color:string,ink:number,tones:SceneTones){if(ink<1||color==='#000000')return color;const rgb=paletteRGB(color),passes=(c:number[])=>{const light=colorLuminance(c.map(v=>255*(1-ink)+v*ink));return contrast(light,tones.background)>=4.5||tones.darkSupport&&Math.max(contrast(light,tones.low),contrast(light,tones.high))>=4.5;};if(passes(rgb))return color;const target=passes([255,255,255])?255:passes([0,0,0])?0:undefined;if(target===undefined)return color;let low=0,high=1;for(let i=0;i<12;i++){const mid=(low+high)/2;if(passes(rgb.map(v=>v+(target-v)*mid)))high=mid;else low=mid;}return paletteHex(rgb.map(v=>v+(target-v)*high));}
/** Assign sampled coverage to included hue families, without making every swatch equally common. */
function includedPalette(palette:ScenePalette,included:readonly string[]){
 const colors=included.map(color=>({color,meanColor:color,weight:0,salience:0}));
 const traits=(color:string)=>{const rgb=paletteRGB(color),hi=Math.max(...rgb),lo=Math.min(...rgb);return {hue:colorHue(rgb),tone:hi/255,chroma:hi>=24&&(hi-lo)/hi>=.18};};
 const targets=colors.map(c=>traits(c.color));
 for(const source of [...palette.accents,...palette.neutrals]){const value=traits(source.color),distances=targets.map(t=>t.chroma!==value.chroma?2+Math.abs(t.tone-value.tone):t.chroma?Math.min(Math.abs(t.hue-value.hue),360-Math.abs(t.hue-value.hue))/180:Math.abs(t.tone-value.tone)),index=distances.indexOf(Math.min(...distances));colors[index].weight+=source.weight;colors[index].salience+=source.salience??source.weight;}
 for(const c of colors){c.weight=Math.max(1/4096,c.weight);c.salience=Math.max(1/4096,c.salience);}return colors;
}
export type MotifCandidate={id:string;color:string;weight:number;attention:number;enabled:boolean;occupation?:number};
/** Membership is ranked by attention; coverage is used only after membership. */
export function motifCandidates(palette:ScenePalette,settings:PaletteSettings={}):MotifCandidate[]{
 const candidates:MotifCandidate[]=(settings.included?.length?includedPalette(palette,settings.included).map(c=>({...c,id:c.color.toLowerCase()})):[...palette.accents,...palette.neutrals].map(c=>({...c,id:c.id??paletteFamily(paletteRGB(c.color))}))).map(c=>({id:c.id,color:c.id==='n0'?'#000000':c.id==='n2'?'#ffffff':c.id==='n1'?paletteHex(Array(3).fill(paletteRGB(c.color).reduce((a,b)=>a+b,0)/3)):c.color,weight:c.weight,attention:c.salience??0,enabled:false})).sort((a,b)=>b.attention-a.attention||a.id.localeCompare(b.id));
 const scores=candidates.map(c=>c.attention).filter(n=>n>0).sort((a,b)=>a-b),middle=Math.floor(scores.length/2),threshold=scores.length?(scores[middle]+scores[Math.floor((scores.length-1)/2)])/16:0;let selected=0;
 for(const c of candidates){c.enabled=settings.motifOverrides?.[c.id]??(settings.included?.length?true:threshold===0||c.attention>=threshold);if(c.enabled&&selected++>=8)c.enabled=false;}
 const members=candidates.filter(c=>c.enabled),order=members.map((_,i)=>i).sort((a,b)=>members[b].weight-members[a].weight||a-b),total=members.reduce((sum,c)=>sum+c.weight,0);
 for(let rank=0;rank<order.length;rank++)members[order[rank]].occupation=members[order[settings.inverseOccupation?order.length-1-rank:rank]].weight/total;
 return candidates;
}
export function imageTextPalette(palette:ScenePalette,settings:PaletteSettings={}){
 const selected=motifCandidates(palette,settings).filter(c=>c.enabled);if(!selected.length)throw Error('Keep at least one motif color.');
 const ink=paletteInk(settings),saturation=settings.saturation??settings.ink==='color';
 return selected.map(c=>{const rgb=paletteRGB(c.color),neutral=Math.max(...rgb)===Math.min(...rgb),textGlow=readableAccent(neutral?c.color:vivid(c.color,saturation),ink,palette.tones);return {textGlow,text:paletteHex(paletteRGB(textGlow).map(v=>255*(1-ink)+v*ink)),weight:c.occupation!,strength:ink,darkSupport:selected.some(c=>c.id==='n0'||c.color==='#000000')};});
}
export function matchedImageColors(combo:ImageColorCombo,settings:PaletteSettings={}){
 const palette=imageTextPalette(combo.source,settings),first=palette[0],available=Math.min(8,motifCandidates(combo.source,settings).length);return {...combo,text:first.text,textGlow:first.textGlow,textPalette:palette.map(c=>c.textGlow),textWeights:palette.map(c=>c.weight),textStrength:first.strength,textDarkSupport:first.darkSupport,textAvailable:available,textRatio:imageRatio(palette.map(c=>c.weight)),node:first.textGlow,nodeGlow:first.textGlow};
}
export function imageColorCombo(pixels:SceneSignal):ImageColorCombo{
 const source=extractScenePalette(pixels);if(!source.accents.length&&!source.neutrals.length)throw Error('Image has no visible colours.');
 return matchedImageColors({source,text:'',textGlow:'',node:'',nodeGlow:'',textPalette:[],textWeights:[],textStrength:1,textDarkSupport:false});
}
export const comboPalette=(combo:ImageColorCombo,settings?:PaletteSettings)=>({...Object.fromEntries(Object.entries(settings??{}).filter(([,value])=>value!==undefined)) as PaletteSettings,mode:'text' as const,colors:combo.textPalette,weights:combo.textWeights,strength:combo.textStrength,darkSupport:combo.textDarkSupport,available:combo.textAvailable,imageRatio:combo.textRatio});
export function applyImageColorCombo(world:World,combo:ImageColorCombo,origin?:Origin){writePaint(world,origin?'nodeText':'text',origin?[origin]:[],{color:combo.text,glowColor:combo.textGlow,palette:comboPalette(combo)});writePaint(world,origin?'nodes':'nodeDefaults',origin?[origin]:[],{color:combo.node,glowColor:combo.nodeGlow});}
