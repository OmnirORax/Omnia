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
