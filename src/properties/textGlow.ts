/** One concentrated halo for text; CSS and raster adapters share its spread. */
export const TEXT_GLOW_MAX=2;
export const TEXT_GLOW_SPREAD={min:0,max:20,step:.1,initial:6} as const;
export const textGlowBlur=(glow:number,spread:number=TEXT_GLOW_SPREAD.initial)=>glow*spread;
export const textGlowShadow=(glow:number,color:string,spread:number=TEXT_GLOW_SPREAD.initial)=>glow>0?`0 0 ${textGlowBlur(glow,spread)}px ${color}`:'none';
