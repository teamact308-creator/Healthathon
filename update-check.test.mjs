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


test('hidden and offline periods do not lose the last revision; return reconciles once',async()=>{
 let visible=true,online=true,value='a',reads=0,changes=0;
 const check=updateCheck({interval:100000,canCheck:()=>visible,read:async()=>{reads++;if(!online)throw TypeError('offline');return value;},onChanged:()=>changes++,onDenied:()=>assert.fail('Network failure is not revoked access')});
 try{await check.tick();visible=false;value='b';await check.tick();assert.equal(reads,1);visible=true;online=false;await check.tick();assert.equal(changes,0);online=true;await check.tick();assert.equal(changes,1);}finally{check.stop();}
});
test('a stopped pending check cannot refresh the next account',async()=>{let release,changes=0;const check=updateCheck({interval:100000,canCheck:()=>true,read:()=>new Promise(r=>release=r),onChanged:()=>changes++,onDenied:()=>{}});const pending=check.tick();check.stop();release('next');await pending;assert.equal(changes,0);});
