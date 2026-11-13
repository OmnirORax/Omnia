const issuer='https://omnia-web-bae-pages.cloudflareaccess.com';
const audience='5d6b072d04e3ec562ee66a50e39458b4cb20a48a33aace8351ef16eb796b10b3';
const bytes=(value:string)=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const applications=new Map<string,{until:number;audience:string}>();
let cached:{until:number;keys:(JsonWebKey&{kid:string})[]}|undefined;
export async function verifyAccess(token:string,fetcher:typeof fetch=fetch,origin?:string){
 try{
  if(token.length>16000)return false;
  let expected=audience;
  if(origin){
   const url=new URL(origin);
   if(url.protocol!=='https:'||url.port||url.origin!==origin||!(url.hostname==='omnium.nexus'||url.hostname==='omnia-web-bae.pages.dev'||/^[a-z0-9-]+\.omnia-web-bae\.pages\.dev$/.test(url.hostname)))return false;
   let app=applications.get(origin);
   if(!app||app.until<Date.now()){
    const response=await fetcher(origin+'/',{redirect:'manual',signal:AbortSignal.timeout(15000)}),location=new URL(response.headers.get('location')??'');await response.body?.cancel();
    if(![302,303,307,308].includes(response.status)||location.origin!==issuer||!location.pathname.startsWith('/cdn-cgi/access/login/'))return false;
    const value=location.searchParams.get('kid');if(!value||!/^[a-f0-9]{64}$/.test(value))return false;
    if(applications.size>=128)applications.clear();app={until:Date.now()+300000,audience:value};applications.set(origin,app);
   }
   expected=app.audience;
  }
  const [head,body,signature,...extra]=token.split('.');if(extra.length||!signature)return false;
  const header=JSON.parse(new TextDecoder().decode(bytes(head))),claims=JSON.parse(new TextDecoder().decode(bytes(body))),now=Date.now()/1000;
  if(header.alg!=='RS256'||claims.iss!==issuer||!Array.isArray(claims.aud)||!claims.aud.includes(expected)||typeof claims.exp!=='number'||claims.exp<=now||claims.nbf>now+30)return false;
  if(!cached||cached.until<now){const response=await fetcher(`${issuer}/cdn-cgi/access/certs`,{signal:AbortSignal.timeout(15000)});if(!response.ok)return false;cached={until:now+300,keys:(await response.json()).keys};}
  const jwk=cached.keys.find(key=>key.kid===header.kid);if(!jwk)return false;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(signature),new TextEncoder().encode(`${head}.${body}`));
 }catch{return false;}
}
