import test from 'node:test';import assert from 'node:assert/strict';import {inspectDocument,scopedObjectPath} from './supabase/functions/_shared/file-safety.mjs';
const encode=s=>new TextEncoder().encode(s);
test('document screening rejects executable, encrypted, truncated and disguised PDF payloads',()=>{
 const pdf='%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF';assert.equal(inspectDocument(encode(pdf),'application/pdf').ok,true);
 for(const payload of [pdf.replace('/Catalog','/Catalog /JavaScript 2 0 R'),pdf.replace('/Catalog','/Catalog /J#61vaScript 2 0 R'),pdf.replace('/Catalog','/Catalog /Encrypt 2 0 R'),'%PDF-1.4 truncated'])assert.equal(inspectDocument(encode(payload)).ok,false);
 assert.equal(inspectDocument(encode(pdf),'image/png').ok,false);assert.equal(inspectDocument(encode('<html>payload</html>')).ok,false);
});
test('encoded traversal and cross-patient object names are denied before file access',()=>{
 const p='11111111-1111-4111-8111-111111111111';assert.equal(scopedObjectPath(p,p+'/source.pdf'),true);
 for(const path of [p+'/%2e%2e/source.pdf',p+'/../source.pdf',p+'/file.pdf?other=1','22222222-2222-4222-8222-222222222222/source.pdf'])assert.equal(scopedObjectPath(p,path),false);
});
