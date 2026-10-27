/** Summaries contain only fixed categories/codes, never raw CLI/container output. */
export function startupFailureSummary(log){
 const text=String(log).replace(/\x1b\[[0-9;]*[A-Za-z]/g,'');
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
 return 'Local backend CLI startup failed; raw credential-bearing output is intentionally not printed.';
}
