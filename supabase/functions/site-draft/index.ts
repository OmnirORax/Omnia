import {draftServer} from '../../../src/cloud/server.ts';
Deno.serve((request:Request)=>draftServer(request,{url:Deno.env.get('SUPABASE_URL')!,key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}));
