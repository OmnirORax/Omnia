import {imageField} from './imageField.ts';
import type {ImageField} from '../properties/imageField.ts';
import {imageRelations} from './imageRelations.ts';
import type {ColorRelations} from '../properties/colorRelations.ts';
import {extractScenePalette,paletteHex,paletteRGB,colorLuminance,nearestPaletteTrait,paletteColorTraits,paletteFamily,PALETTE_FAMILIES,type SceneSignal,type ScenePalette,type SceneTones} from './palette.ts';
import {buildPixelMotifs,selectedMotifExtent} from './pixelMotifs.ts';
import type {PixelMotifs} from '../properties/pixelMotifs.ts';
import {imageRatio} from '../properties/focusPalette.ts';
import {paletteInk,type PaletteSettings} from '../properties/textPalette.ts';
import {writePaint} from '../core/appearance.ts';
import type {World,Origin} from '../core/model.ts';
export type ImageColorCombo={text:string;textGlow:string;node:string;nodeGlow:string;textPalette:string[];textPixelSources?:string[];textPixelMotifs?:PixelMotifs;textWeights:number[];textStrength:number;textDarkSupport:boolean;textAvailable?:number;textRatio?:number[];textRelations?:ColorRelations;textField?:ImageField;source:ScenePalette};
const vivid=(color:string,boost:boolean|number)=>{const rgb=paletteRGB(color),hi=Math.max(...rgb),lo=Math.min(...rgb),span=hi-lo;if(!hi)return '#ffffff';const saturation=typeof boost==='number'?Math.min(1,boost):boost?Math.max(.85,span/hi):span/hi;return paletteHex(rgb.map(c=>span?255*(1-saturation+saturation*(c-lo)/span):255));};
const contrast=(a:number,b:number)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
/** Adjust only the failing accent, rather than bleaching every other motif color. */
function readableAccent(color:string,ink:number,tones:SceneTones){if(ink<1||color==='#000000')return color;const rgb=paletteRGB(color),passes=(c:number[])=>{const light=colorLuminance(c.map(v=>255*(1-ink)+v*ink));return contrast(light,tones.background)>=4.5||tones.darkSupport&&Math.max(contrast(light,tones.low),contrast(light,tones.high))>=4.5;};if(passes(rgb))return color;const target=passes([255,255,255])?255:passes([0,0,0])?0:undefined;if(target===undefined)return color;let low=0,high=1;for(let i=0;i<12;i++){const mid=(low+high)/2;if(passes(rgb.map(v=>v+(target-v)*mid)))high=mid;else low=mid;}return paletteHex(rgb.map(v=>v+(target-v)*high));}
function nearestIncluded(color:string,included:readonly string[]){
 return nearestPaletteTrait(paletteColorTraits(paletteRGB(color)),included.map(c=>paletteColorTraits(paletteRGB(c))));
}
/** Assign sampled coverage to included hue families, without making every swatch equally common. */
function includedPalette(palette:ScenePalette,included:readonly string[]){
 const colors=included.map(color=>({color,meanColor:color,weight:0,salience:0}));
 for(const source of [...palette.accents,...palette.neutrals]){const index=nearestIncluded(source.color,included);colors[index].weight+=source.weight;colors[index].salience+=source.salience??source.weight;}
 for(const c of colors){c.weight=Math.max(1/4096,c.weight);c.salience=Math.max(1/4096,c.salience);}return colors;
}
export type MotifCandidate={id:string;color:string;weight:number;attention:number;enabled:boolean;occupation?:number};
/** Membership is ranked by attention; coverage is used only after membership. */
export function motifCandidates(palette:ScenePalette,settings:PaletteSettings={}):MotifCandidate[]{
 const candidates:MotifCandidate[]=(settings.included?.length?includedPalette(palette,settings.included).map(c=>({...c,id:c.color.toLowerCase()})):[...palette.accents,...palette.neutrals].map(c=>({...c,id:c.id??paletteFamily(paletteRGB(c.color))}))).map(c=>({id:c.id,color:c.id==='n0'?'#000000':c.id==='n2'?'#ffffff':c.id==='n1'?paletteHex(Array(3).fill(paletteRGB(c.color).reduce((a,b)=>a+b,0)/3)):c.color,weight:c.weight,attention:c.salience??0,enabled:false})).sort((a,b)=>b.attention-a.attention||a.id.localeCompare(b.id));
 const scores=candidates.map(c=>c.attention).filter(n=>n>0).sort((a,b)=>a-b),middle=Math.floor(scores.length/2),threshold=scores.length?(scores[middle]+scores[Math.floor((scores.length-1)/2)])/16:0;
 for(const c of candidates){c.enabled=settings.motifOverrides?.[c.id]??(settings.included?.length?true:threshold===0||c.attention>=threshold);}
 const members=candidates.filter(c=>c.enabled),order=members.map((_,i)=>i).sort((a,b)=>members[b].weight-members[a].weight||a-b),total=members.reduce((sum,c)=>sum+c.weight,0);
 for(let rank=0;rank<order.length;rank++)members[order[rank]].occupation=members[order[settings.inverseOccupation?order.length-1-rank:rank]].weight/total;
 return candidates;
}
export function imageTextPalette(palette:ScenePalette,settings:PaletteSettings={}){
 const selected=motifCandidates(palette,settings).filter(c=>c.enabled);if(!selected.length)throw Error('Keep at least one motif color.');
 const ink=paletteInk(settings),colored=settings.ink==='color',saturation=settings.saturation??colored;
 const adjustContrast=colored||settings.distribution!=='pixels';
 return selected.map(c=>{const rgb=paletteRGB(c.color),neutral=Math.max(...rgb)===Math.min(...rgb),rawGlow=neutral?c.color:vivid(c.color,saturation),textGlow=adjustContrast?readableAccent(rawGlow,ink,palette.tones):rawGlow;return {source:c.color,textGlow,text:paletteHex(paletteRGB(textGlow).map(v=>255*(1-ink)+v*ink)),weight:c.occupation!,strength:ink,darkSupport:selected.some(c=>c.id==='n0'||c.color==='#000000')};});
}
const motifLayouts=new WeakMap<ScenePalette,Map<string,PixelMotifs|undefined>>();
function resolvedPixelMotifs(source:ScenePalette,owners:readonly number[],image:string|undefined,settings:PaletteSettings){
 const crop=settings.motifCrop?.image===image?settings.motifCrop?.rect:undefined;
 let layouts=motifLayouts.get(source);
 if(!layouts){layouts=new Map();motifLayouts.set(source,layouts);}
 const key=JSON.stringify([owners,image,crop,!!settings.centerImagePixels]);
 if(!layouts.has(key)){
  if(layouts.size>=12)layouts.delete(layouts.keys().next().value!);
  const extent=crop??(settings.centerImagePixels?selectedMotifExtent(source.spatial,owners):undefined);
  layouts.set(key,buildPixelMotifs(source.spatial,owners,image,extent));
 }
 return layouts.get(key);
}
export function matchedImageColors(combo:ImageColorCombo,settings:PaletteSettings={},image?:string){
 const palette=imageTextPalette(combo.source,settings),first=palette[0],candidates=motifCandidates(combo.source,settings),members=candidates.filter(c=>c.enabled),available=candidates.length;
 let textRelations:ColorRelations|undefined,textField:ImageField|undefined,textPixelMotifs:PixelMotifs|undefined;
 const relations=settings.distribution==='image'&&combo.source.spatial;
 const repeat=settings.distribution==='pixels'&&(settings.repeatMotifs||settings.centerImagePixels);
 if(relations||repeat){
  const destinations=new Map([...combo.source.accents,...combo.source.neutrals].map(c=>{
   const family=c.id??paletteFamily(paletteRGB(c.color));
   const id=settings.included?.length?settings.included[nearestIncluded(c.color,settings.included)].toLowerCase():family;
   return [family,members.findIndex(member=>member.id===id)];
  }));
  if(relations){
   const mapping=relations.families.map(id=>destinations.get(id)??-1);
   textRelations=imageRelations(combo.source,mapping,members.length);textField=imageField(combo.source,mapping,palette.map(c=>c.weight));
  }
  if(repeat)textPixelMotifs=resolvedPixelMotifs(combo.source,PALETTE_FAMILIES.map(id=>destinations.get(id)??-1),image,settings);
 }
 const node=settings.distribution==='pixels'
  ?palette.find(entry=>{const [r,g,b]=paletteRGB(entry.textGlow);return r!==g||g!==b;})?.textGlow??first.textGlow
  :first.textGlow;
 return {...combo,text:first.text,textGlow:first.textGlow,textPalette:palette.map(c=>c.textGlow),textPixelSources:settings.distribution==='pixels'?palette.map(c=>c.source):undefined,textPixelMotifs,textWeights:palette.map(c=>c.weight),textStrength:first.strength,textDarkSupport:first.darkSupport,textAvailable:available,textRatio:imageRatio(palette.map(c=>c.weight)),textRelations,textField,node,nodeGlow:node};
}
export function imageColorCombo(pixels:SceneSignal):ImageColorCombo{
 const source=extractScenePalette(pixels);if(!source.accents.length&&!source.neutrals.length)throw Error('Image has no visible colours.');
 return matchedImageColors({source,text:'',textGlow:'',node:'',nodeGlow:'',textPalette:[],textWeights:[],textStrength:1,textDarkSupport:false});
}
export const comboPalette=(combo:ImageColorCombo,settings?:PaletteSettings)=>({...Object.fromEntries(Object.entries(settings??{}).filter(([,value])=>value!==undefined)) as PaletteSettings,mode:'text' as const,colors:combo.textPalette,pixelSources:combo.textPixelSources,pixelMotifs:combo.textPixelMotifs,weights:combo.textWeights,strength:combo.textStrength,darkSupport:combo.textDarkSupport,available:combo.textAvailable,imageRatio:combo.textRatio,relations:combo.textRelations,field:combo.textField});
export function applyImageColorCombo(world:World,combo:ImageColorCombo,origin?:Origin){writePaint(world,origin?'nodeText':'text',origin?[origin]:[],{color:combo.text,glowColor:combo.textGlow,palette:comboPalette(combo)});writePaint(world,origin?'nodes':'nodeDefaults',origin?[origin]:[],{color:combo.node,glowColor:combo.nodeGlow});}
