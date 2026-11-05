export async function authorizeTransfer({url,headers,input,operation,kind},request=fetch){
 if(input.privacy_version!==1||typeof input.privacy_request_id!=='string')throw Error('Review the AI transfer and refresh the app if needed.');
 const response=await request(url+'/rest/v1/rpc/authorize_ai_transfer',{
  method:'POST',headers:{...headers,'Content-Type':'application/json'},
  signal:AbortSignal.timeout(10000),
  body:JSON.stringify({p_patient:input.patient_id,p_request:input.privacy_request_id,p_operation:operation,p_kind:kind,p_version:input.privacy_version})
 });
 if(!response.ok)throw Error('AI approval was not accepted. Review the transfer or use manual entry.');
 return response.json();
}
