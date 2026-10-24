// Only public configuration may enter the static browser bundle. Never print it.
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
let valid = false;
try {
  const parsed = new URL(url);
  const publicKey = key.startsWith('sb_publishable_') ||
    JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString()).role === 'anon';
  valid = parsed.protocol === 'https:' && !parsed.username && !parsed.password && publicKey;
} catch { /* Fail closed without logging configuration values. */ }
if (!valid) {
  console.error('Set VITE_SUPABASE_URL (HTTPS) and VITE_SUPABASE_PUBLISHABLE_KEY (public key) before building.');
  process.exit(1);
}
console.log('Public frontend configuration validated.');
