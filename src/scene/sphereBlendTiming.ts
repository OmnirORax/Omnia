import type * as THREE from 'three';
export type FrameTiming={completionMs:number;gpuMs?:number};
export function rendererIdentity(renderer:THREE.WebGLRenderer){const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');const name=String(debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER));return {name,software:/swiftshader|llvmpipe|softpipe|software/i.test(name)};}
/** JS/driver call elapsed is reported separately from valid GPU timer queries. */
export async function timedSphereFrame(renderer:THREE.WebGLRenderer,render:()=>void,valid:()=>boolean):Promise<FrameTiming>{
 const gl=renderer.getContext() as WebGL2RenderingContext;if(gl.isContextLost())throw Error('WebGL context lost; reopen the comparison before measuring.');
 const identity=rendererIdentity(renderer),ext=identity.software?null:gl.getExtension('EXT_disjoint_timer_query_webgl2');
 const query=ext?gl.createQuery():null;let started=false;
 try{
  const start=performance.now();if(query){gl.beginQuery(ext.TIME_ELAPSED_EXT,query);started=true;}render();if(gl.isContextLost())throw Error('WebGL context lost during measurement.');if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);started=false;}gl.finish();const completionMs=performance.now()-start;
  if(!query)return {completionMs};
  const deadline=performance.now()+2000;
  while(valid()&&!document.hidden&&performance.now()<deadline){
   if(gl.getParameter(ext.GPU_DISJOINT_EXT))return {completionMs};
   if(gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE))return {completionMs,gpuMs:Number(gl.getQueryParameter(query,gl.QUERY_RESULT))/1e6};
   await new Promise(resolve=>setTimeout(resolve,16));
  }return {completionMs};
 }finally{if(started)gl.endQuery(ext.TIME_ELAPSED_EXT);if(query)gl.deleteQuery(query);}
}
export const median=(values:number[])=>{if(!values.length)return undefined;const sorted=[...values].sort((a,b)=>a-b),i=Math.floor(sorted.length/2);return sorted.length%2?sorted[i]:(sorted[i-1]+sorted[i])/2;};
