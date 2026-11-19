import {rolldown} from 'rolldown';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
export async function buildDraftService(file){
 const bundle=await rolldown({input:resolve('supabase/functions/site-draft/index.ts'),platform:'neutral',output:{format:'esm'}});
 try{const result=await bundle.generate({format:'esm'}),chunks=result.output.filter(part=>part.type==='chunk');if(chunks.length!==1)throw Error('Draft service must be one self-contained module.');await mkdir(dirname(file),{recursive:true});await writeFile(file,chunks[0].code);}finally{await bundle.close();}
}
if(process.argv[1]===new URL(import.meta.url).pathname){const file=resolve(process.argv[2]??'.cache/site-draft/index.ts');await buildDraftService(file);console.log(file);}
