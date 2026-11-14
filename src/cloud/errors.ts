export const REVISION_CONFLICT = 'The shared draft changed in another session. Pull to use it, or Push to replace it with your local work.';
export class DraftConflictError extends Error {
 constructor(){super(REVISION_CONFLICT);this.name='DraftConflictError';}
}
/** Only known storage errors may cross the server boundary. */
export function storageFailure(status:number,value:unknown):string{
 const message=value&&typeof value==='object'&&'message' in value?value.message:undefined;
 switch(message){
  case 'Draft image library is full':return 'The shared image library is full (100 images or 100 MiB). This image was not uploaded. Shared storage needs cleanup before retrying.';
  case 'Draft image missing':return 'An image used by this draft is missing from shared storage. Push again to upload it.';
  case 'Invalid draft':return 'Shared storage rejected the workspace format or size. Reload the latest build and check the 4 MB workspace limit.';
  case 'Open the latest Omnium build before pushing this draft':return 'Open the latest Omnium build before pushing this draft';
 }
 return status===401||status===403?'Shared storage access was denied. The server configuration needs attention.':`Shared storage request failed (HTTP ${status}). Retry; if it persists, the service needs attention.`;
}
export function requestFailure(status:number):string{
 if(status===401||status===403)return 'Your Access session could not be verified. Reload this page and sign in again.';
 if(status===413)return 'The upload is too large. Use a smaller image or workspace.';
 if(status===429)return 'Too many shared draft requests. Wait a moment and retry.';
 if(status===546)return 'The shared draft service reached its resource limit. Retry once other uploads finish; use a smaller image if it repeats.';
 return `The shared draft service could not complete the request (HTTP ${status}). Retry in a moment.`;
}
export function connectionFailure(error:unknown):string{
 return error instanceof Error&&(error.name==='TimeoutError'||error.name==='AbortError')?'The shared draft request timed out. Check your connection and retry.':'Could not reach the shared draft service. Check your connection and reload to renew your Access session.';
}
