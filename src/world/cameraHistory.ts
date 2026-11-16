import {sameValue} from '../core/equality.ts';
/** OrbitControls reconstructs camera vectors through spherical coordinates.
 * Accept numerical noise only on pose coordinates, never on node identities. */
export function cameraHistoryMatches(path:readonly string[],actual:unknown,expected:unknown){
 const field=path.at(-1),close=(a:number,b:number)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(a),Math.abs(b));
 if((field==='position'||field==='target'||field==='up')&&(path.length===1||path.length===2&&path[0]==='returnView')&&Array.isArray(actual)&&Array.isArray(expected)&&actual.length===3&&expected.length===3)return actual.every((v,i)=>typeof v==='number'&&typeof expected[i]==='number'&&close(v,expected[i]));
 if(path.length===1&&field==='depth'&&typeof actual==='number'&&typeof expected==='number')return close(actual,expected);
 return sameValue(actual,expected);
}
