/** Surface transmission stays independent of authored overall opacity. */
export const translucentOpacity=(opacity:number,translucency=0)=>opacity*(1-translucency);

export type SurfaceTransmission={opacity:number;translucency:number;radius:number};
const CENTER_POWER=2.15;
const EDGE_POWER=3;

/** The boundary curve is shared by spheres and glyphs; only the geometry differs. */
export function boundaryOpacity(translucency:number,radius:number,radial:number){
 const edge=(1-Math.sqrt(Math.max(0,1-radial*radial)))**EDGE_POWER;
 const t=radius>=1?0:Math.max(0,Math.min(1,(radial-radius)/(1-radius)));
 const transmission=1-translucency*(1-t*t*(3-2*t));
 return transmission*((1-edge)*transmission**CENTER_POWER+edge);
}
export const boundaryTransmissionGLSL=`
 float boundaryEdge(float facing){return pow(1.0-facing,${EDGE_POWER.toFixed(1)});}
 float boundaryTransmission(float translucency,float clearRadius,float radial,float edge){
  float shell=clearRadius>=1.0?0.0:smoothstep(clearRadius,1.0,radial);
  float transmission=1.0-translucency*(1.0-shell);
  return transmission*mix(pow(transmission,${CENTER_POWER}),1.0,edge);
 }
`;
