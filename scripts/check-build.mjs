import {readdir,readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const files=await readdir(new URL('../dist/',import.meta.url));
assert.equal(files.length,18,'Static allowlist changed; review public output');
for(const name of files){assert.ok(!name.startsWith('.')&&!/\.sql$|\.py$|test|secret|account|README/i.test(name),'Private artifact in build: '+name);const text=await readFile(new URL('../dist/'+name,import.meta.url),'utf8');assert.ok(!/sb_secret_|SUPABASE_SERVICE_ROLE_KEY|TWILIO_API_KEY_SECRET|-----BEGIN .*PRIVATE KEY/.test(text),'Server credential reference in '+name);}
console.log('Verified 18 public browser assets; no private/backend files in output.');
