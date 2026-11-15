/** A tab can outlive the deployment that supplied its lazy-module URLs. */
export async function loadEditorModule<T>(load:()=>Promise<T>,unavailable:()=>void):Promise<T>{
 try{return await load();}
 catch(error){
  if(error instanceof Error&&/failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|unable to preload css/i.test(error.message)){
   unavailable();
   throw Error('The editor could not load. Reload to get the current build or renew your session.',{cause:error});
  }
  throw error;
 }
}
