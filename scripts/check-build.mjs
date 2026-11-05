import {readdir,readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const base=new URL('../dist/',import.meta.url);
const files=(await readdir(base,{recursive:true,withFileTypes:true})).filter(f=>f.isFile()).map(f=>(f.parentPath+'/' +f.name).slice(base.pathname.length).replace(/^\//,'')).sort();
const expected=['prescription-crop.js','ai-privacy-ui.js','supabase/functions/_shared/ai-privacy.mjs','patient-ui.js','patient-model.mjs','auth-ui.js','auth-recovery.mjs','bucket-ui.js','intake-model.mjs','messaging-ui.js','conversation-model.mjs','messaging-core.mjs','operations-ui.js','operations-model.mjs','capture-ui.js','plan-ui.js','index.html','app.js','style.css','workflow.mjs','database.html','database-client.js','db-config.js','connected-store.js','connected-model.mjs','vcpi-model.mjs','supabase/functions/_shared/vcpi.mjs'].sort();
assert.deepEqual(files,expected,'Static allowlist changed; review public output');
for(const name of files){const text=await readFile(new URL(name,base),'utf8');assert.ok(!/sb_secret_|SUPABASE_SERVICE_ROLE_KEY|TWILIO_API_KEY_SECRET|-----BEGIN .*PRIVATE KEY/.test(text),'Server credential reference in '+name);}
console.log(`Verified ${files.length} explicitly allowed browser assets; no server credentials or backend handlers.`);
