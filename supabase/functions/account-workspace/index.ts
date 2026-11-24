import {accountWorkspaceServer} from '../../../src/backend/workspaceServer.ts';
const origins=(Deno.env.get('OMNIA_ALLOWED_ORIGINS')??'https://omnium.nexus,http://127.0.0.1:5173,http://localhost:5173').split(',').map((origin:string)=>origin.trim()).filter(Boolean);
Deno.serve((request:Request)=>accountWorkspaceServer(request,{url:Deno.env.get('SUPABASE_URL')!,key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,origins}));
