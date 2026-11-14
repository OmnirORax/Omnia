/** Surface transmission stays independent of authored overall opacity. */
export const translucentOpacity=(opacity:number,translucency=0)=>opacity*(1-translucency);
