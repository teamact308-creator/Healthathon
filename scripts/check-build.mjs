import {readdir, readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = new URL('../dist/', import.meta.url);
// Explicit public output. The shared minimizer is a public module;
// endpoint handlers, credentials, tests and source documents remain excluded.
const allowed = [
  "ai-privacy-ui.js",
  "app.js",
  "auth-recovery.mjs",
  "auth-ui.js",
  "bucket-ui.js",
  "capture-ui.js",
  "connected-model.mjs",
  "connected-store.js",
  "conversation-model.mjs",
  "database-client.js",
  "database.html",
  "db-config.js",
  "index.html",
  "intake-model.mjs",
  "messaging-core.mjs",
  "messaging-ui.js",
  "operations-model.mjs",
  "operations-ui.js",
  "patient-model.mjs",
  "patient-ui.js",
  "plan-ui.js",
  "prescription-crop.js",
  "style.css",
  "supabase/functions/_shared/ai-privacy.mjs",
  "workflow.mjs"
];
async function walk(directory, prefix = '') {
  const output = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) output.push(...await walk(new URL(entry.name + '/', directory), path + '/'));
    else {assert.ok(entry.isFile(), 'Unexpected public artifact: ' + path); output.push(path);}
  }
  return output;
}
const files = (await walk(root)).sort();
assert.deepEqual(files, allowed, 'Static allowlist changed; review public output');
for (const path of files) {
  const body = await readFile(new URL(path, root), 'utf8');
  assert.ok(!/sb_secret_|SUPABASE_SERVICE_ROLE_KEY|TWILIO_API_KEY_SECRET|-----BEGIN .*PRIVATE KEY/.test(body), 'Server credential reference in ' + path);
}
console.log(`Verified ${files.length} explicitly allowed public browser assets; no private/backend files in output.`);
