const pattern=/^data:font\/(?:woff2?|ttf|otf);base64,[A-Za-z0-9+/]+={0,2}$/;
export const isImportedFont=(value:string)=>value.length<=700000&&pattern.test(value);
const loaded=new Map<string,string>();
export function importedFontFamily(value:string){
 const known=loaded.get(value);if(known)return known;
 const family=`OmniumImported${loaded.size}`;
 if(typeof FontFace==='undefined')return 'system-ui';
 const face=new FontFace(family,`url(${value})`);document.fonts.add(face);loaded.set(value,family);
 void face.load().catch(()=>{document.fonts.delete(face);loaded.delete(value);});return family;
}
export async function importFont(file:File){
 if(file.size>512*1024)throw Error('Choose a font up to 512 KiB.');
 const bytes=new Uint8Array(await file.arrayBuffer()),tag=String.fromCharCode(...bytes.subarray(0,4));
 const type=tag==='wOF2'?'woff2':tag==='wOFF'?'woff':tag==='OTTO'?'otf':bytes[0]===0&&bytes[1]===1&&bytes[2]===0&&bytes[3]===0?'ttf':null;
 if(!type)throw Error('Choose a WOFF, WOFF2, TTF or OTF font.');
 let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 const value=`data:font/${type};base64,${btoa(binary)}`;
 const probe=new FontFace('OmniumFontValidation',bytes);await probe.load();return value;
}
