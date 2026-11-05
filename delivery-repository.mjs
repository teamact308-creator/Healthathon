// Server-only adapter. RPC privileges remain service-only; never bundle this file into the frontend.
export function createDeliveryRepository({url,serviceKey,request=fetch}){
 if(!/^https:\/\//.test(url||'')||!serviceKey)throw Error('Server repository configuration required');
 const rpc=async(action,data={})=>{const response=await request(url+'/rest/v1/rpc/delivery_worker_rpc',{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_data:data}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Delivery repository unavailable');return response.json();};
 return {status:()=>rpc('status'),candidates:()=>rpc('candidates'),claim:(id,version)=>rpc('claim',{job_id:id,version}),result:(id,key,status,provider)=>rpc('result',{job_id:id,event_key:key,status,provider_id:provider}),findProvider:provider=>rpc('provider',{provider_id:provider}),recipient:async(patient,channel)=>(await rpc('recipient',{patient_id:patient,channel}))?.address};
}
