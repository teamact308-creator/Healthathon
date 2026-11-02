// Server-only transport adapter. Not in the browser build or connected to a scheduled sender.
export function createTwilioAdapter({channel,accountSid,apiKeySid,apiKeySecret,from,contentSid,approvedSmsBody,resolveRecipient,fetchImpl=fetch}){
 if(!['whatsapp','sms'].includes(channel)||!/^AC[0-9a-f]{32}$/i.test(accountSid||'')||!/^SK[0-9a-f]{32}$/i.test(apiKeySid||'')||!apiKeySecret||typeof resolveRecipient!=='function')throw Error('Incomplete server transport configuration');
 const address=value=>typeof value==='string'&&(channel==='whatsapp'?/^whatsapp:\+[1-9]\d{7,14}$/:/^\+[1-9]\d{7,14}$/).test(value);
 if(!address(from))throw Error('Invalid channel sender');
 if(channel==='whatsapp'&&!/^HX[0-9a-f]{32}$/i.test(contentSid||''))throw Error('Approved WhatsApp template required');
 if(channel==='sms'&&(typeof approvedSmsBody!=='string'||!approvedSmsBody.trim()||approvedSmsBody.length>1600))throw Error('Approved SMS text required');
 return {async send(job){
  if(job.channel!==channel)throw Error('Channel mismatch');
  const to=await resolveRecipient(job.patient_id,channel);if(!address(to))throw Error('Verified enrolled destination required');
  const form=new URLSearchParams({To:to,From:from,...(channel==='whatsapp'?{ContentSid:contentSid}:{Body:approvedSmsBody})});
  const response=await fetchImpl('https://api.twilio.com/2010-04-01/Accounts/'+accountSid+'/Messages.json',{method:'POST',headers:{Authorization:'Basic '+btoa(apiKeySid+':'+apiKeySecret),'Content-Type':'application/x-www-form-urlencoded'},body:form.toString(),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Provider request failed; reconcile before another attempt');
  const value=await response.json();if(!/^(SM|MM)[0-9a-f]{32}$/i.test(value.sid||''))throw Error('Uncertain provider response; reconcile before retry');
  return {id:value.sid};
 }};
}
