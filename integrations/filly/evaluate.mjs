// Offline synthetic comparison. No credentials, network or care-record writes.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export const corpus=[
 {id:'taken-en',text:'I took my medicine at 08:00.',status:'taken',clarify:false,required:['08:00']},
 {id:'uncertain-en',text:'I think I took my medicine. I am not sure.',status:'unclear',clarify:true,required:['I think','not sure']},
 {id:'negated-hi',text:'मैंने दवा नहीं ली।',status:'missed',clarify:false,required:['नहीं']},
 {id:'future-en',text:'I will take my medicine tomorrow.',status:'unclear',clarify:true,required:['will','tomorrow']},
 {id:'fraction-and-hold',text:'Medicine A 0.5 tablet Monday at 08:00. Hold Medicine B until review.',status:'unclear',clarify:true,required:['0.5','Monday','08:00','Hold Medicine B until review']}
];
export function evaluate(results){
 if(!Array.isArray(results)||results.length!==corpus.length)throw Error('Provide one synthetic result for every corpus item');
 if(new Set(results.map(row=>row.id)).size!==corpus.length||results.some(row=>!corpus.some(f=>f.id===row.id)))throw Error('Unknown or duplicate fixture');
 return corpus.map(fixture=>{
  const result=results.find(row=>row.id===fixture.id);
  const sourceFaithful=result.source_excerpt===fixture.text;
  const statusCorrect=result.reported_status===fixture.status&&result.needs_clarification===fixture.clarify;
  const preserved=fixture.required.every(token=>result.source_excerpt?.includes(token));
  const noAdvice=Array.isArray(result.recommendations)&&result.recommendations.length===0;
  return {id:fixture.id,sourceFaithful,statusCorrect,preserved,noAdvice,pass:sourceFaithful&&statusCorrect&&preserved&&noAdvice};
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{
  const selfTest=process.argv.includes('--self-test');
  if(!selfTest&&!process.argv.includes('--synthetic-only'))throw Error('Synthetic-only acknowledgement required');
  const file=process.argv.find(arg=>arg.startsWith('--results='))?.slice('--results='.length);
  const results=selfTest?corpus.map(f=>({id:f.id,source_excerpt:f.text,reported_status:f.status,needs_clarification:f.clarify,recommendations:[]})):JSON.parse(await readFile(file,'utf8'));
  const checks=evaluate(results);
  console.log(JSON.stringify({mode:selfTest?'harness self-test, no provider used':'synthetic captured-output comparison',checks},null,2));
  if(checks.some(check=>!check.pass))process.exitCode=1;
 }catch(error){console.error(error.message);process.exitCode=1;}
}
