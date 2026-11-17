/** Screen-space detail protection shared by the scene's one glow composite.
 * A wide edge differs from only one neighbour; a thin stroke/gap differs from
 * both. Sampling at 1.5 output pixels preserves features approaching 1–2 pixels
 * without using camera distance, node counts or geometry-specific heuristics. */
export const sceneGlowDetail = `
float glowPeak(vec3 c){return max(c.r,max(c.g,c.b));}
float detailProtection(float c,float l,float r,float u,float d){
 float hi=max(c,max(max(l,r),max(u,d))),lo=min(c,min(min(l,r),min(u,d)));
 float contrast=hi-lo;
 float thin=max(abs(c-(l+r)*.5),abs(c-(u+d)*.5))/max(hi,.00001);
 return smoothstep(.6,.9,thin)*smoothstep(.005,.06,contrast);
}
// This is the final gain: never interpolate uncapped emission back in after
// applying it. Fully protected strokes/gaps keep the original base image;
// partially protected pixels have a finite halo budget at any user strength.
float detailIntensityLimit(float peak,float halo,float protect){
 if(protect<=0.)return 1.;
 float budget=peak*.05*(1.-protect)/max(protect,.00001);
 return min(1.,budget/max(halo,.00001));
}
vec3 detailGlow(sampler2D source,sampler2D halo,sampler2D narrow,vec2 uv,vec2 pixel,vec3 center,float strength){
 vec3 wide=texture2D(halo,uv).rgb;
 if(glowPeak(wide)==0.)return wide;
 vec3 l=texture2D(source,uv-vec2(pixel.x*1.5,0.)).rgb;
 vec3 r=texture2D(source,uv+vec2(pixel.x*1.5,0.)).rgb;
 vec3 u=texture2D(source,uv-vec2(0.,pixel.y*1.5)).rgb;
 vec3 d=texture2D(source,uv+vec2(0.,pixel.y*1.5)).rgb;
 float hi=glowPeak(max(center,max(max(l,r),max(u,d))));
 // Evaluate each channel so equally bright coloured details are protected too.
 float protect=max(detailProtection(center.r,l.r,r.r,u.r,d.r),max(
  detailProtection(center.g,l.g,r.g,u.g,d.g),detailProtection(center.b,l.b,r.b,u.b,d.b)));
 if(protect==0.)return wide;
 // Match the existing UnrealBloom gain (3 * strength). The wider second
 // scale yields first as features shrink; the original halo remains outside
 // the detail neighbourhood, retaining the luminous appearance.
 vec3 close=texture2D(narrow,uv).rgb*(3.*strength);
 vec3 adaptive=mix(wide,close,protect);
 float limit=detailIntensityLimit(hi,glowPeak(adaptive),protect);
 return adaptive*limit;
}`;
