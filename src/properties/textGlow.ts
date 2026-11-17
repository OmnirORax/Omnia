/** One concentrated halo for text; CSS and raster adapters share its spread. */
export const textGlowBlur=(glow:number)=>glow*6;
export const textGlowShadow=(glow:number,color:string)=>glow>0?`0 0 ${textGlowBlur(glow)}px ${color}`:'none';
