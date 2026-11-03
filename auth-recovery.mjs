import {SUPABASE_URL,SUPABASE_KEY} from './db-config.js';
const origins=new Set(['https://healthathon.vercel.app','http://localhost:4173']);
let recovery=null;
async function call(path,method,body,token){
 const r=await fetch(SUPABASE_URL+'/auth/v1/'+path,{method,headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 const data=await r.json().catch(()=>null);if(!r.ok)throw Error(r.status===429?'Too many attempts. Wait a few minutes and try again.':method==='PUT'?'Password could not be updated. Use a different password, or request a fresh reset link.':'Unable to complete this request. Try again or request a fresh reset link.');return data;
}
export function validatePassword(password,confirmation){if(password!==confirmation)throw Error('The passwords do not match.');if(password.length<12||password.length>128)throw Error('Use 12–128 characters. A memorable passphrase works well.');}
export async function requestPasswordReset(email,origin){
 if(!origins.has(origin))throw Error('Open the published WholeCare app to reset your password.');
 if(/\.test$/i.test(email.trim()))throw Error('Demo .test addresses cannot receive email. Sign in using your existing demo password, then choose Change password.');
 await call('recover?redirect_to='+encodeURIComponent(origin+'/?reset=1'),'POST',{email:email.trim()});
}
export function readRecoveryURL(href){
 const url=new URL(href),hash=new URLSearchParams(url.hash.slice(1));
 const relevant=url.searchParams.has('reset')||hash.has('access_token')||hash.has('error')||url.searchParams.has('error');
 if(!relevant)return null;
 if(!origins.has(url.origin))return {error:'Open your reset link on the published WholeCare app.'};
 if(hash.has('error')||url.searchParams.has('error'))return {error:'This reset link is invalid or expired. Request a new link.'};
 if(hash.get('type')!=='recovery'||!hash.get('access_token'))return {error:'A valid password-reset link is required. Request a new link.'};
 return {token:hash.get('access_token')};
}
export async function beginRecovery(token){
 recovery=null;const user=await call('user','GET',null,token);if(!user?.id||!user.email)throw Error('This reset link is invalid or expired. Request a new link.');recovery={token,id:user.id,email:user.email};return user.email;
}
export const clearRecovery=()=>{recovery=null;};
export async function finishRecovery(password,confirmation){
 validatePassword(password,confirmation);if(!recovery)throw Error('Request a fresh reset link.');
 const active=recovery;const user=await call('user','PUT',{password},active.token);if(user?.id!==active.id)throw Error('Unable to confirm the password change. Request a fresh reset link.');
 // Revoke refresh sessions after changing the password. Existing access JWTs may live until expiry.
 try{await call('logout?scope=global','POST',{},active.token);}catch{}finally{recovery=null;}
}
