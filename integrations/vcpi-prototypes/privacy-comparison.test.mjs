import test from 'node:test';import assert from 'node:assert/strict';import {syntheticSource,instructionSpans,minimizeSynthetic,rehearsal} from './privacy-comparison.mjs';
test('privacy prototype is disabled without explicit opt-in',()=>assert.throws(()=>rehearsal()));
test('minimization retains instruction spans and removes fixture identifiers',()=>{const r=rehearsal({optIn:true});assert.deepEqual(r.minimized.missing,[]);assert.deepEqual(r.minimized.identifierExposure,[]);assert.ok(r.decimalLoss.missing.includes('0.5'));assert.ok(r.omittedHold.missing.includes('Hold'));assert.equal(r.minimized.activationAllowed,false);});
test('arbitrary patient content cannot enter fixture prototype',()=>assert.throws(()=>minimizeSynthetic({source:'arbitrary',spans:instructionSpans,syntheticOnly:true,optIn:true})));
test('span corruption fails closed',()=>assert.throws(()=>minimizeSynthetic({source:syntheticSource,spans:[{start:-1,end:9}],syntheticOnly:true,optIn:true})));
