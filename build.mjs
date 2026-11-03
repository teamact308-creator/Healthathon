import {mkdir, rm, copyFile} from 'node:fs/promises';
const files = ['patient-ui.js','patient-model.mjs','auth-ui.js','auth-recovery.mjs','bucket-ui.js','intake-model.mjs','messaging-ui.js','conversation-model.mjs','messaging-core.mjs','operations-ui.js','operations-model.mjs','capture-ui.js','vcpi-model.mjs','plan-ui.js','index.html','app.js','style.css','workflow.mjs','database.html','database-client.js','db-config.js','connected-store.js','connected-model.mjs'];
await rm(new URL('./dist/', import.meta.url), {recursive:true, force:true});
await mkdir(new URL('./dist/', import.meta.url));
for (const file of files) await copyFile(new URL(file, import.meta.url), new URL(`dist/${file}`, import.meta.url));
console.log(`Built ${files.length} browser assets into dist`);

await mkdir(new URL('./dist/supabase/functions/_shared/', import.meta.url), {recursive:true});
await copyFile(new URL('./supabase/functions/_shared/vcpi.mjs', import.meta.url),new URL('./dist/supabase/functions/_shared/vcpi.mjs',import.meta.url));
