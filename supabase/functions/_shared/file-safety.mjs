// Bounded structural/active-content screening. This is not an antivirus verdict.
export function scopedObjectPath(patient,path){
 return typeof patient==='string'&&typeof path==='string'&&path.startsWith(patient+'/')&&/^[0-9a-f-]{36}\/[A-Za-z0-9_-]{1,180}\.(?:pdf|png|jpe?g|webm|mp3|wav|m4a|mp4)$/i.test(path);
}
export function inspectDocument(input,declared=''){
 const b=input instanceof Uint8Array?input:new Uint8Array(input);
 const reject=reason=>({ok:false,reason});
 if(b.length<12||b.length>8388608)return reject('Choose a nonempty document up to 8 MB.');
 const text=new TextDecoder('latin1').decode(b);
 if(text.startsWith('%PDF-')){
  if(declared&&declared.split(';')[0]!=='application/pdf')return reject('File type does not match its contents.');
  if(!/%%EOF\s*$/.test(text)||!text.includes('/Type')||!text.includes('endobj'))return reject('The PDF is incomplete or unsupported.');
  const names=text.replace(/#([0-9a-f]{2})/gi,(_,h)=>String.fromCharCode(parseInt(h,16)));
  if(/\/(?:JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia|Encrypt)\b/i.test(names))return reject('Active, attached or encrypted PDF content is not accepted. Use a plain report or image.');
  return {ok:true,mime:'application/pdf',screen:'static-active-content-check'};
 }
 if([137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v)){
  if(declared&&declared.split(';')[0]!=='image/png')return reject('File type does not match its contents.');
  const view=new DataView(b.buffer,b.byteOffset,b.byteLength);let offset=8,header=false,data=false,end=false;
  while(offset+12<=b.length){const size=view.getUint32(offset),kind=String.fromCharCode(...b.slice(offset+4,offset+8));if(size>8388608||offset+size+12>b.length)return reject('The PNG is truncated.');
   if(!header){if(kind!=='IHDR'||size!==13)return reject('Invalid PNG header.');const width=view.getUint32(offset+8),height=view.getUint32(offset+12);if(!width||!height||width*height>40000000)return reject('Use an image under 40 megapixels.');header=true;}
   if(kind==='IDAT'&&size)data=true;
   offset+=size+12;if(kind==='IEND'){end=size===0&&offset===b.length;break;}
  }
  return header&&data&&end?{ok:true,mime:'image/png',screen:'bounded-structure-check'}:reject('The PNG is incomplete or has trailing content.');
 }
 if(b[0]===255&&b[1]===216&&b.at(-2)===255&&b.at(-1)===217){
  if(declared&&declared.split(';')[0]!=='image/jpeg')return reject('File type does not match its contents.');
  let offset=2,dimensions=false;
  while(offset+4<b.length){if(b[offset++]!==255)return reject('Invalid JPEG marker.');let marker=b[offset++];while(marker===255)marker=b[offset++];if(marker===218)break;const size=(b[offset]<<8)|b[offset+1];if(size<2||offset+size>b.length)return reject('The JPEG is truncated.');
   if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(size<8)return reject('Invalid JPEG dimensions.');const height=(b[offset+3]<<8)|b[offset+4],width=(b[offset+5]<<8)|b[offset+6];if(!width||!height||width*height>40000000)return reject('Use an image under 40 megapixels.');dimensions=true;}offset+=size;
  }
  return dimensions?{ok:true,mime:'image/jpeg',screen:'bounded-structure-check'}:reject('Unsupported JPEG image.');
 }
 return reject('Choose a valid PDF, PNG or JPEG file.');
}
