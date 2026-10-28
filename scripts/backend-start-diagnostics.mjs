/** Summaries contain only fixed categories/codes, never raw CLI/container output. */
export function startupFailureSummary(log){
 const text=String(log).replace(/\x1b\[[0-9;]*[A-Za-z]/g,'');
 if(/client version.*too old|minimum supported API version|client is newer than server/i.test(text))return 'Docker client/server API versions are incompatible.';
 if(/could not start|error while loading shared libraries|exec format error|cannot execute binary/i.test(text))return 'Supabase CLI executable could not start on this runner.';
 if(/failed to parse|cannot unmarshal|unknown.*config|invalid.*config/i.test(text))return 'Supabase local configuration was rejected.';
 if(/HealthCheckTimeoutError|container is not ready:\s*unhealthy/i.test(text)){
  const services=['auth','storage','db','kong','rest','edge_runtime','inbucket'].filter(name=>text.includes(`supabase_${name}_omnia container is not ready`));
  return `Local backend health checks failed${services.length?` (${services.join(', ')})`:''}.`;
 }
 if(/(?:pull|image|registry|manifest|daemon)[\s\S]{0,1500}(?:403|forbidden)|(?:403|forbidden)[\s\S]{0,1500}(?:pull|image|registry|manifest)/i.test(text))return 'Container image registry access was denied (HTTP 403).';
 if(/429|too many requests|rate limit/i.test(text))return 'Container image registry rate limit was reached.';
 if(/no space left|not enough disk|disk quota/i.test(text))return 'Local backend startup ran out of disk space.';
 if(/cannot connect to the docker daemon|docker.*not running|permission denied.*docker.sock/i.test(text))return 'Docker daemon is unavailable or inaccessible.';
 const sql=text.match(/SQLSTATE[ :]*(\w{5})\b/i);
 if(sql)return `Local database startup/migration failed (SQLSTATE ${sql[1].toUpperCase()}).`;
 if(/TLS handshake|connection refused|network is unreachable|i\/o timeout|ETIMEDOUT|ENOTFOUND/i.test(text))return 'Local backend dependency connection failed or timed out.';
 const known=new Set('docker client server api version old minimum supported executable binary exec format library config toml parse field flag unknown unsupported permission denied file socket daemon auth storage postgres database migration health ready not found image pull registry forbidden unauthorized download request network connect connection status timeout error failed install dependencies'.split(' '));
 const hints=[...new Set(text.toLowerCase().match(/[a-z]+/g)??[])].filter(word=>known.has(word)).slice(0,24);
 return `Local backend CLI startup failed; raw credential-bearing output is intentionally not printed.${hints.length?` Diagnostic keywords: ${hints.join(', ')}.`:''}`;
}
