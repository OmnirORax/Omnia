/** Shared neon profile: strength changes coverage; spread changes width. */
export const TEXT_GLOW_MAX=2;
export const TEXT_GLOW_SPREAD={min:0,max:20,step:.1,initial:6} as const;
const PROFILE=[{scale:.2,gain:1},{scale:.65,gain:.8},{scale:1.6,gain:.5}] as const;
export function textGlowLayers(glow:number,spread:number=TEXT_GLOW_SPREAD.initial){
 if(!(glow>0)||!(spread>0))return [];
 return PROFILE.map(({scale,gain})=>({blur:spread*scale,opacity:Math.min(1,glow*gain)}));
}
export function textGlowShadow(glow:number,color:string,spread:number=TEXT_GLOW_SPREAD.initial){
 const layers=textGlowLayers(glow,spread);
 return layers.length?layers.map(({blur,opacity})=>`0 0 ${blur}px color-mix(in srgb,${color} ${opacity*100}%,transparent)`).join(','):'none';
}
