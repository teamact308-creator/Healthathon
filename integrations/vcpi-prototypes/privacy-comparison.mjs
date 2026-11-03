// Isolated synthetic-only experiment. No network, file uploads, AI calls or plan writes.
export const syntheticSource='SYNTHETIC PERSON\nAddress: FICTIONAL ADDRESS\nMedicine A 0.5 tablet Monday 08:00\nHold Medicine B until clinician review';
export const instructionSpans=(()=>{const first=syntheticSource.indexOf('Medicine A');return [{start:first,end:syntheticSource.indexOf('\n',first)},{start:syntheticSource.indexOf('Hold'),end:syntheticSource.length}];})();
export function minimizeSynthetic({source,spans,syntheticOnly=false,optIn=false}){
 if(!syntheticOnly||!optIn)throw Error('Explicit synthetic-only opt-in required');
 // Fixture identity restriction prevents this prototype from accepting arbitrary patient content.
 if(source!==syntheticSource)throw Error('Only bundled fictional fixture accepted');
 if(!Array.isArray(spans)||!spans.length)throw Error('Human-selected instruction spans required');
 const selected=spans.map(({start,end})=>{if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>source.length)throw Error('Invalid source span');return {start,end,text:source.slice(start,end)};});
 return {text:selected.map(x=>x.text).join('\n'),sourceSpans:selected,authority:'Original source remains authoritative; minimized text is an unverified derivative'};
}
export function compareSynthetic(candidate){
 const tokens=['0.5','Monday','08:00','Hold','Medicine B','until clinician review'];
 return {missing:tokens.filter(t=>!candidate.includes(t)),identifierExposure:['SYNTHETIC PERSON','FICTIONAL ADDRESS'].filter(t=>candidate.includes(t)),activationAllowed:false};
}
export function rehearsal({optIn=false}={}){
 const minimized=minimizeSynthetic({source:syntheticSource,spans:instructionSpans,syntheticOnly:true,optIn});
 return {scope:'Frozen text fixtures, not an OCR accuracy or vendor comparison',original:compareSynthetic(syntheticSource),minimized:compareSynthetic(minimized.text),decimalLoss:compareSynthetic(minimized.text.replace('0.5','5')),omittedHold:compareSynthetic(minimized.text.split('\n')[0])};
}
