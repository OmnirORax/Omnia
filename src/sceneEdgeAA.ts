/** Spatial edge AA fused into the existing glow composite. Five nearby samples
 * identify flat pixels; only contrast edges need the four directional samples.
 * No extra render target, scene draw, history buffer or animation clock. */
export const sceneEdgeAA = `
uniform vec2 texel;
float edgeLuma(vec3 c){return dot(c,vec3(.299,.587,.114));}
vec3 edgeColor(sampler2D source,vec2 uv,vec3 center){
 float nw=edgeLuma(texture2D(source,uv+texel*vec2(-1.,-1.)).rgb);
 float ne=edgeLuma(texture2D(source,uv+texel*vec2(1.,-1.)).rgb);
 float sw=edgeLuma(texture2D(source,uv+texel*vec2(-1.,1.)).rgb);
 float se=edgeLuma(texture2D(source,uv+texel*vec2(1.,1.)).rgb);
 float m=edgeLuma(center),lo=min(m,min(min(nw,ne),min(sw,se))),hi=max(m,max(max(nw,ne),max(sw,se)));
 if(hi-lo<max(.0312,hi*.125))return center;
 vec2 direction=vec2(-((nw+ne)-(sw+se)),(nw+sw)-(ne+se));
 float reduce=max((nw+ne+sw+se)*.03125,.0078125);
 direction=clamp(direction/(min(abs(direction.x),abs(direction.y))+reduce),vec2(-4.),vec2(4.))*texel;
 vec3 a=.5*(texture2D(source,uv-direction/6.).rgb+texture2D(source,uv+direction/6.).rgb);
 vec3 b=a*.5+.25*(texture2D(source,uv-direction*.5).rgb+texture2D(source,uv+direction*.5).rgb);
 float l=edgeLuma(b);return l<lo||l>hi?a:b;
}`;
