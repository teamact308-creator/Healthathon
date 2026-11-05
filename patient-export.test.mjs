import {test} from 'node:test';import assert from 'node:assert/strict';import {patientExport} from './patient-export.mjs';
test('patient download excludes auth, provider and private-file credentials while declaring partial coverage',()=>{
 const result=patientExport({patient:{id:'p',display_name:'Demo',secret:'no'},token:'no',rawEvidence:[{id:'e',loop_id:'l',label:'Report',storage_path:'private/no',signed_url:'no'}],messages:[{provider_token:'no'}],historyLimits:{events:120}},0);
 assert.equal(result.patient.id,'p');assert.match(result.coverage,/not a complete/);assert.equal(result.reports[0].label,'Report');assert.doesNotMatch(JSON.stringify(result),/private\/no|signed_url|provider_token|"token"|"secret"/);
});
