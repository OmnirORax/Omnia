/** Give a sampled hue the same full chroma range as a vivid motif swatch.
 * Leave neutral and near-neutral pixels alone so noise doesn't pick a hue. */
export const vividImagePixelGLSL=`
 vec3 vividImagePixel(vec3 rgb){
  rgb=clamp(rgb,0.0,1.0);
  float high=max(rgb.r,max(rgb.g,rgb.b));
  float low=min(rgb.r,min(rgb.g,rgb.b));
  float span=high-low;
  vec3 vivid=(rgb-low)/max(span,0.00001);
  return mix(rgb,vivid,smoothstep(0.015,0.085,span));
 }
`;
