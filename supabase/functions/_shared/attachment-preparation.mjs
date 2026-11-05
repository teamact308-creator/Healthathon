import {inspectDocument,scopedObjectPath} from './file-safety.mjs';
export async function boundedDocument(response,max=8388608){
 if(!response.ok||!response.body||Number(response.headers.get('content-length'))>max)throw Error('Private file unavailable or too large');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('Choose a document up to 8 MB');chunks.push(value);}}catch(error){await reader.cancel();throw error;}
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
 return bytes;
}
export function attachmentReference(patient,bucket,path){return ['care-evidence','plan-documents','meal-photos'].includes(bucket)&&scopedObjectPath(patient,path)&&/\.(pdf|png|jpe?g)$/i.test(path);}
export async function prepareAttachment(response){
 const bytes=await boundedDocument(response),screen=inspectDocument(bytes,response.headers.get('content-type')||'');if(!screen.ok)throw Error(screen.reason);
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
 return {mime:screen.mime,size:bytes.length,sha256,screen:'structural-only-not-malware-clearance',prepared_at:new Date().toISOString()};
}
