import {accountProxy} from '../../src/backend/proxy.ts';
export const onRequest=({request}:{request:Request})=>accountProxy(request,'account-workspace');
