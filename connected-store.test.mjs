import {test} from 'node:test';import assert from 'node:assert/strict';
const memory=new Map();globalThis.sessionStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const {signIn,hasSession,loadWorkspace,signOut}=await import('./connected-store.js');
const response=(value,status=200)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(value)});
test('failed sign-in cannot restore the previous account session',async()=>{
 globalThis.fetch=async()=>response({access_token:'fixture',refresh_token:'fixture-refresh',expires_at:Date.now()/1000+3600});await signIn('fixture','fixture');assert.equal(hasSession(),true);
 globalThis.fetch=async()=>response({message:'Invalid sign-in'},400);await assert.rejects(()=>signIn('other','incorrect'),/Invalid sign-in/);assert.equal(hasSession(),false);
});
test('concurrent requests share refresh and reject an unassigned workspace',async()=>{
 let refreshes=0;globalThis.fetch=async(url)=>url.includes('/auth/')?response({access_token:'fixture',refresh_token:'fixture-refresh',expires_at:0}):response({memberships:[]});await signIn('fixture','fixture');
 globalThis.fetch=async(url)=>{if(url.includes('refresh_token')){refreshes++;await Promise.resolve();return response({access_token:'new-fixture',refresh_token:'fixture-refresh',expires_at:Date.now()/1000+3600});}return response({memberships:[]});};
 const results=await Promise.allSettled([loadWorkspace(),loadWorkspace()]);assert.equal(refreshes,1);assert.ok(results.every(r=>r.status==='rejected'&&/no assigned/.test(r.reason.message)));
});
test('logout clears local identity even when the network is unavailable',async()=>{globalThis.fetch=async()=>{throw Error('offline')};await signOut();assert.equal(hasSession(),false);});
test('workspace fetch pages schedules by their item primary key and includes operations data',async()=>{
 const paths=[];globalThis.fetch=async(url)=>{
  paths.push(url);if(url.includes('/auth/'))return response({access_token:'fixture',refresh_token:'fixture',expires_at:Date.now()/1000+3600});
  if(url.includes('my_context'))return response({memberships:[{patient_id:'fixture-patient',role:'clinician'}]});
  if(url.includes('/plan_schedules')){assert.ok(url.includes('order=item_id.asc'));assert.ok(!url.includes('order=id.asc'));}
  if(url.includes('/patients?'))return response([{id:'fixture-patient',display_name:'Fixture patient'}]);
  return response([]);
 };
 await signIn('fixture','fixture');const w=await loadWorkspace();assert.equal(w.role,'Clinician');assert.equal(w.state.patient.id,'fixture-patient');assert.deepEqual(w.state.intake,[]);assert.ok(paths.some(p=>p.includes('/processing_events')));
});
test('observation reads traverse provider row limits using stable time/id cursors',async()=>{
 let observations=0;globalThis.fetch=async(url)=>{
  if(url.includes('/auth/'))return response({access_token:'fixture',refresh_token:'fixture',expires_at:Date.now()/1000+3600});
  if(url.includes('my_context'))return response({memberships:[{patient_id:'fixture-patient',role:'patient'}]});
  if(url.includes('/glucose_observations')){observations++;if(observations===1)return response(Array.from({length:500},(_,i)=>({id:String(i).padStart(36,'0'),observed_at:'2026-11-02T10:00:00Z',value:110})));assert.ok(decodeURIComponent(url).includes('and(observed_at.eq.2026-11-02T10:00:00Z,id.lt.'));return response([{id:'last',observed_at:'2026-11-01T10:00:00Z',value:100}]);}
  return response([]);
 };
 await signIn('fixture','fixture');const w=await loadWorkspace();assert.equal(observations,2);assert.equal(w.state.observations.length,501);
});
test('password change rejects a fresh grant for a different identity without updating',async()=>{
 const {changeOwnPassword}=await import('./connected-store.js');let updates=0;
 globalThis.fetch=async(url,opts)=>{if(url.includes('grant_type=password'))return response({access_token:'fixture',refresh_token:'fixture',expires_at:Date.now()/1000+3600,user:{id:'other'}});if(opts.method==='PUT')updates++;return response({id:'current',email:'fixture@example.com'});};
 await signIn('fixture@example.com','fixture');await assert.rejects(()=>changeOwnPassword('fixture','memorable-demo-phrase','memorable-demo-phrase'),/Current password/);assert.equal(updates,0);
});
test('authenticated password change re-verifies the account and clears its local session',async()=>{
 const {changeOwnPassword}=await import('./connected-store.js');const calls=[];
 globalThis.fetch=async(url,opts)=>{calls.push({url,method:opts.method});if(url.includes('grant_type=password'))return response({access_token:'fixture',refresh_token:'fixture',expires_at:Date.now()/1000+3600,user:{id:'current'}});return response({id:'current',email:'fixture@example.com'});};
 await signIn('fixture@example.com','fixture');await changeOwnPassword('fixture','memorable-demo-phrase','memorable-demo-phrase');assert.ok(calls.some(x=>x.method==='PUT'));assert.ok(calls.some(x=>x.url.endsWith('logout?scope=global')));assert.equal(hasSession(),false);
});
