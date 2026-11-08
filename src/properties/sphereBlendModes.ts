/** One portable mode declaration for appearance validation, controls and shader dispatch. */
export const SPHERE_BLEND_MODES=[
 {id:'contrast',label:'Auto contrast'},
 {id:'screen',label:'Screen · lighten'},
 {id:'multiply',label:'Multiply · darken'},
 {id:'difference',label:'Difference · invert'},
 {id:'softLight',label:'Soft light'},
 {id:'normal',label:'Normal colour'},
] as const;
export const sphereBlendModeIndex=(value:unknown)=>Math.max(0,SPHERE_BLEND_MODES.findIndex(mode=>mode.id===value));
