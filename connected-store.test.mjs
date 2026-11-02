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
