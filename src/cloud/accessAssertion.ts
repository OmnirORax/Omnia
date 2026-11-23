/** Shared extraction only; each upstream verifies the signed assertion. */
export function accessAssertion(request:Request):string|undefined{
 return request.headers.get('cf-access-jwt-assertion')??request.headers.get('cookie')?.split(';').map(value=>value.trim()).find(value=>value.startsWith('CF_Authorization='))?.slice('CF_Authorization='.length);
}
