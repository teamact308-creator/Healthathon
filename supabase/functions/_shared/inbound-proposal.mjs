// Converts an already verified provider message to a review proposal, never to a care mutation.
export function inboundProposal(text){
 const value=String(text||'').trim(),command=value.toUpperCase();
 const map={TAKEN:{domain:'medication',status:'taken'},MISSED:{domain:'medication',status:'missed'},DELAYED:{domain:'medication',status:'delayed'},MEAL:{domain:'meals',status:'meal_logged'},DATA:{domain:'glucose',status:'availability_confirmed'}};
 if(command==='REPORT')return {kind:'report',domain:'test',status:null};
 return map[command]?{kind:'activity',...map[command]}:{kind:'clarify',domain:null,status:null};
}
