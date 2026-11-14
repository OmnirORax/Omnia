/** Shared pattern source: geometry owns its palette connection; consumers only opt in. */
export const PATTERN_FUNCTION='paint.pattern';
export const PATTERN_FIELDS=[
 {key:'global',label:'Apply pattern globally',kind:'toggle',initial:false},
 {key:'source',label:'Pattern colours',kind:'select',initial:'scene.image.palette',options:[{id:'scene.image.palette',label:'Follow scene image'},{id:'manual',label:'Manual pair'}]},
 {key:'preset',label:'Pattern preset',kind:'select',initial:'rings',options:[{id:'rings',label:'Ring + dot'},{id:'dots',label:'Alternating dots'},{id:'checker',label:'Checker'},{id:'stripes',label:'Stripes'}]},
 {key:'cell',label:'Pattern spacing (px)',kind:'number',initial:4,min:2,max:24,step:1},
 {key:'density',label:'Pattern fill',kind:'number',initial:.8,min:.25,max:1,step:.05},
 {key:'outline',label:'Text keyline (px)',kind:'number',initial:.35,min:0,max:1,step:.05},
 {key:'colorA',label:'Manual / fallback colour A',kind:'color',initial:'#32c890'},
 {key:'colorB',label:'Manual / fallback colour B',kind:'color',initial:'#ffda55'},
] as const;
export const patternProperty=(key:string)=>`paint.pattern.${key}`;
export type PatternSettings={global:boolean;source:string;preset:'rings'|'dots'|'checker'|'stripes';cell:number;density:number;outline:number;colorA:string;colorB:string};
export function patternSettings(values:Record<string,unknown>={}):PatternSettings{
 const out:Record<string,unknown>={};
 for(const field of PATTERN_FIELDS){const value=values[patternProperty(field.key)];
  out[field.key]=field.kind==='toggle'?typeof value==='boolean'?value:field.initial:field.kind==='number'?typeof value==='number'&&Number.isFinite(value)?Math.max(field.min,Math.min(field.max,value)):field.initial:field.kind==='color'?typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:field.initial:field.options.some(option=>option.id===value)?value:field.initial;
 }return out as PatternSettings;
}
export type PaletteSignal={source:string;revision:string;colors:readonly string[]};
export type ScenePaletteSignal=PaletteSignal&{source:'scene.image.palette'};
export type PatternPaint={source:'paint.pattern';revision:string;settings:PatternSettings;colors:readonly [string,string];inherited:boolean};
export function resolvePattern(settings:PatternSettings,signal:PaletteSignal|null):PatternPaint{
 const valid=signal?.colors.filter(color=>/^#[0-9a-f]{6}$/i.test(color))??[],inherited=settings.source!=='manual'&&signal?.source===settings.source&&valid.length>0,colors:readonly[string,string]=inherited?[valid[0],valid[1]??valid[0]]:[settings.colorA,settings.colorB];
 return {source:'paint.pattern',revision:JSON.stringify([settings,colors]),settings,colors,inherited};
}
const rgb=(hex:string)=>[1,3,5].map(at=>parseInt(hex.slice(at,at+2),16));
const hex=(channels:readonly number[])=>'#'+channels.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
/** Deterministic bounded palette extraction; accents must occupy a meaningful fraction. */
export function scenePalette(pixels:Uint8ClampedArray):readonly[string,string]{
 const bins=new Map<number,{rgb:number[];weight:number}>();
 for(let i=0;i<pixels.length;i+=4){const alpha=pixels[i+3]/255;if(alpha<.05)continue;const r=pixels[i],g=pixels[i+1],b=pixels[i+2],hi=Math.max(r,g,b),lo=Math.min(r,g,b),sat=hi?(hi-lo)/hi:0;
  const key=(r>>4)*256+(g>>4)*16+(b>>4),weight=alpha*(.25+.75*sat)*(hi<16?.05:1),bin=bins.get(key)??{rgb:[0,0,0],weight:0};bin.rgb[0]+=r*weight;bin.rgb[1]+=g*weight;bin.rgb[2]+=b*weight;bin.weight+=weight;bins.set(key,bin);
 }
 const ranked=[...bins.values()].map(bin=>({rgb:bin.rgb.map(v=>v/bin.weight),weight:bin.weight})).sort((a,b)=>b.weight-a.weight||hex(a.rgb).localeCompare(hex(b.rgb)));
 if(!ranked.length)return ['#32c890','#ffda55'];const first=ranked[0];
 const distance=(a:readonly number[],b:readonly number[])=>a.reduce((sum,v,i)=>sum+(v-b[i])**2,0)/(255*255*3);
 const second=ranked.filter(bin=>bin.weight>=first.weight*.015&&distance(bin.rgb,first.rgb)>.025).sort((a,b)=>distance(b.rgb,first.rgb)*Math.sqrt(b.weight)-distance(a.rgb,first.rgb)*Math.sqrt(a.weight))[0];
 const alternate=first.rgb.reduce((a,b)=>a+b,0)/3<128?first.rgb.map(v=>v*.35+165):first.rgb.map(v=>v*.25);
 return [hex(first.rgb),hex(second?.rgb??alternate)];
}
const tiles=new Map<string,{url:string;size:number;borderURL:string;slice:number}>();
export function patternTile(paint:PatternPaint,brightness=1,opacity=1){
 const key=JSON.stringify([paint.revision,brightness,opacity]);const found=tiles.get(key);if(found)return found;
 const {cell,density,preset}=paint.settings,c=cell,side=2*c;
 const colors=paint.colors.map(value=>rgb(value).map(v=>Math.max(0,Math.min(255,v*brightness)))),a=hex(colors[0]),b=hex(colors[1]);
 const ground=hex(colors[0].map((v,i)=>(v+colors[1][i])*.09)),edge=colors.flat().reduce((x,y)=>x+y,0)/6>120?'#071019':'#effcff',r=c*.45*density;
 const geometry=preset==='checker'?`<path fill="${b}" d="M0 0H${c}V${c}H0ZM${c} ${c}H${side}V${side}H${c}Z"/>`:preset==='stripes'?`<path stroke="${b}" stroke-width="${c*density}" d="M${c/2} 0V${side}M${1.5*c} 0V${side}"/>`:[0,1,2,3].map(i=>{const x=(i%2+.5)*c,y=(Math.floor(i/2)+.5)*c,color=(i===0||i===3)?a:b;return `<circle cx="${x}" cy="${y}" r="${r}" fill="${preset==='rings'&&(i===0||i===3)?ground:color}" stroke="${edge}" stroke-width=".5"/><circle cx="${x}" cy="${y}" r="${Math.max(.2,r-.45)}" fill="${preset==='rings'&&(i===0||i===3)?ground:color}" stroke="${color}" stroke-width=".6"/>`;}).join('');
 const tile=`<rect width="${side}" height="${side}" fill="${preset==='checker'||preset==='stripes'?a:ground}"/>${geometry}`;
 const encode=(svg:string)=>`url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
 const svg=(border:boolean)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${border?4*c:side}" height="${border?4*c:side}" viewBox="0 0 ${border?4*c:side} ${border?4*c:side}"><defs><pattern id="p" width="${side}" height="${side}" patternUnits="userSpaceOnUse">${tile}</pattern></defs><rect width="100%" height="100%" fill="url(#p)" opacity="${Math.max(0,Math.min(1,opacity))}"/></svg>`;
 const result={url:encode(svg(false)),size:side,borderURL:encode(svg(true)),slice:c};if(tiles.size>=128)tiles.delete(tiles.keys().next().value!);tiles.set(key,result);return result;
}
