import {mkdir, rm, copyFile} from 'node:fs/promises';
const files = ['capture-ui.js','plan-ui.js','index.html','app.js','style.css','workflow.mjs','database.html','database-client.js','db-config.js','connected-store.js','connected-model.mjs'];
await rm(new URL('./dist/', import.meta.url), {recursive:true, force:true});
await mkdir(new URL('./dist/', import.meta.url));
for (const file of files) await copyFile(new URL(file, import.meta.url), new URL(`dist/${file}`, import.meta.url));
console.log(`Built ${files.length} browser assets into dist`);
