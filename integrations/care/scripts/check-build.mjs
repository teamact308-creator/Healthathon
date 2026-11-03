import {readFile, readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = new URL('../dist/', import.meta.url);
const files = [];
async function walk(url) {
  for (const entry of await readdir(url, {withFileTypes: true})) {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), url);
    if (entry.isDirectory()) await walk(path); else files.push(path);
  }
}
await walk(root);
assert.ok(files.some(f => f.pathname.endsWith('/assets/remoteEntry.js')), 'Federated manifest entry is missing');
assert.ok(files.some(f => f.pathname.endsWith('/index.html')), 'Standalone preview is missing');
for (const file of files) {
  assert.ok(!/\.map$|\.env$|\.sql$|README|package-lock|\.test\.|\.check\./.test(file.pathname), 'Private/source file in build');
  const text = await readFile(file, 'utf8');
  assert.ok(!/sb_secret_|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|TWILIO_AUTH_TOKEN|gylnitduoasmybadblcp/.test(text), 'Current backend/provider configuration leaked into prototype');
}
console.log(`Verified ${files.length} prototype assets, standalone page and federated entry; no existing backend configuration.`);
