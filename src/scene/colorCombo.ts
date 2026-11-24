import {extractScenePalette,paletteHex,paletteRGB,colorLuminance,type ScenePalette} from './palette.ts';
import {paletteInk,type PaletteSettings} from '../properties/textPalette.ts';
import {writePaint} from '../core/appearance.ts';
import type {World,Origin} from '../core/model.ts';
export type ImageColorCombo={text:string;textGlow:string;node:string;nodeGlow:string;textPalette:string[];textWeights:number[];textStrength:number;source:ScenePalette};
const vivid=(color:string)=>{const rgb=paletteRGB(color),hi=Math.max(...rgb);return hi?paletteHex(rgb.map(c=>255*c/hi)):'#ffffff';};
/** Keep colored text readable against the image's typical dark/mid backdrop. */
function readableStrength(source:ScenePalette,colors:readonly string[],desired:number){const ranked=[...source.accents,...source.neutrals].map(c=>({weight:c.weight,light:colorLuminance(paletteRGB(c.color))})).sort((a,b)=>a.light-b.light);let covered=0,background=0;for(const c of ranked){covered+=c.weight;background=c.light;if(covered>=.4)break;}if(background>.18)return desired;const target=(background+.05)*4.5-.05,anchors=colors.map(paletteRGB),rgb=anchors.flatMap((a,i)=>{const b=anchors[i+1];return b?[a,...[.25,.5,.75].map(t=>a.map((v,k)=>v+(b[k]-v)*t))]:[a];}),passes=(strength:number)=>rgb.every(c=>colorLuminance(c.map(v=>255*(1-strength)+v*strength))>=target);if(passes(desired))return desired;let low=.02,high=desired;for(let i=0;i<12;i++){const mid=(low+high)/2;if(passes(mid))low=mid;else high=mid;}return low;}
/** Rank defining chromatic accents separately from broad, weakly tinted scenery. */
export function imageTextPalette(palette:ScenePalette,settings:PaletteSettings={}){
 const ranked=palette.accents.map(c=>({...c,score:c.salience??Math.sqrt(c.weight)*((Math.max(...paletteRGB(c.color))-Math.min(...paletteRGB(c.color)))/255)**4})).sort((a,b)=>b.score-a.score),best=ranked[0]?.score??0,totalChroma=ranked.reduce((sum,c)=>sum+c.weight,0),diversity=Math.exp(-ranked.reduce((sum,c)=>{const share=c.weight/Math.max(.000001,totalChroma);return sum+share*Math.log(share);},0)),cutoff=best*(.04+.21*((diversity-1)/7)**2);
 const selected=settings.match==='palette'?ranked.filter(c=>c.weight>=.025):ranked.filter(c=>c.score>=cutoff&&c.score>0).slice(0,settings.match==='light'||settings.match==='dark'?1:8);
 const stops=selected.map(c=>({textGlow:vivid(c.color),weight:settings.match==='palette'?c.weight:c.score}));
 const white=palette.neutrals.filter(c=>Math.max(...paletteRGB(c.color))>=160).reduce((sum,c)=>sum+c.weight,0);
 const neutral=settings.match==='dark'?'#000000':settings.match==='light'?'#ffffff':white>.025?'#ffffff':undefined;
 if(neutral&&stops.length<8)stops.push({textGlow:neutral,weight:stops.reduce((sum,c)=>sum+c.weight,0)*.3||1});
 if(!stops.length)stops.push({textGlow:'#ffffff',weight:1});const total=stops.reduce((sum,c)=>sum+c.weight,0),ink=readableStrength(palette,stops.map(c=>c.textGlow),paletteInk(settings));
 return stops.slice(0,8).map(c=>({...c,strength:ink,weight:c.weight/total,text:paletteHex(paletteRGB(c.textGlow).map(v=>255*(1-ink)+v*ink))}));
}
export function matchedImageColors(combo:ImageColorCombo,settings:PaletteSettings={}){
 const palette=imageTextPalette(combo.source,settings),first=palette[0];return {...combo,text:first.text,textGlow:first.textGlow,textPalette:palette.map(c=>c.textGlow),textWeights:palette.map(c=>c.weight),textStrength:first.strength,node:first.textGlow,nodeGlow:first.textGlow};
}
export function imageColorCombo(pixels:Uint8ClampedArray):ImageColorCombo{
 const source=extractScenePalette(pixels);if(!source.accents.length&&!source.neutrals.length)throw Error('Image has no visible colours.');
 return matchedImageColors({source,text:'',textGlow:'',node:'',nodeGlow:'',textPalette:[],textWeights:[],textStrength:1});
}
export function applyImageColorCombo(world:World,combo:ImageColorCombo,origin?:Origin){writePaint(world,origin?'nodeText':'text',origin?[origin]:[],{color:combo.text,glowColor:combo.textGlow,palette:{mode:'text',colors:combo.textPalette,weights:combo.textWeights,strength:combo.textStrength}});writePaint(world,origin?'nodes':'nodeDefaults',origin?[origin]:[],{color:combo.node,glowColor:combo.nodeGlow});}
