import test from 'node:test';import assert from 'node:assert/strict';import {mayRefresh,updateCheck} from './update-check.mjs';
test('automatic refresh preserves dirty forms, recording dialogs, hidden tabs and editors',()=>{
 for(const state of [{dirty:true},{dialog:true},{busy:true},{hidden:true},{view:'plans'},{view:'context'},{view:'capture'}])assert.equal(mayRefresh(state),false);
 assert.equal(mayRefresh({view:'messages'}),true);
});
test('change polling is serialized, reports changes and handles revoked access',async()=>{
 let value='a',changed=0,denied=0;const check=updateCheck({interval:100000,canCheck:()=>true,read:async()=>value,onChanged:async()=>changed++,onDenied:()=>denied++});
 try{await check.tick();await check.tick();assert.equal(changed,0);value='b';await check.tick();assert.equal(changed,1);}finally{check.stop();}
 const revoked=updateCheck({interval:100000,canCheck:()=>true,read:async()=>{throw Object.assign(Error('Revoked'),{status:403});},onChanged:()=>{},onDenied:()=>denied++});
 try{await revoked.tick();assert.equal(denied,1);}finally{revoked.stop();}
});
