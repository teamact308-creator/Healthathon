// Shared deterministic command contract. No AI inference and no automatic care writes.
export const commands={TAKEN:['med','taken'],MISSED:['med','missed'],DELAYED:['med','delayed'],MEAL:['meal','meal_logged'],DATA:['cgm','availability_confirmed']};
export function proposeReply(text,item,{consented=false,now=Date.now()}={}){
 const value=String(text??'').trim();
 if(!value||value.length>2000)return {kind:'clarify',message:'Enter a message of 1–2,000 characters.'};
 const command=value.toUpperCase();
 if(command==='STOP')return {kind:'stop',message:'Simulation outreach stopped. No live channel preference was changed.'};
 if(command==='START')return {kind:'start',message:'Use the simulation permission checkbox to resume. START alone does not verify a phone or enroll a live channel.'};
 if(command==='HELP')return {kind:'help',message:'Choose a due task, then use REPORT, TAKEN, MISSED, DELAYED, MEAL or DATA. NOTE: your text sends an unmatched note. Every care change requires review and confirmation. STOP disables simulated outreach.'};
 if(!consented)return {kind:'blocked',message:'Enable simulation permission first. Live WhatsApp and SMS remain disabled.'};
 if(/^NOTE:/i.test(value)){
  const note=value.slice(5).trim();return note?{kind:'note',note,message:'Send this note to the human association queue? It will not complete a task.'}:{kind:'clarify',message:'Add the note after NOTE:.'};
 }
 const expected=command==='REPORT'?['test',null]:commands[command];
 if(!expected)return {kind:'clarify',message:'I could not map that message safely. Use HELP for supported commands, or NOTE: to send a note to your team. No care task changed.'};
 if(!item||(command==='REPORT'&&item.state!=='DUE')||item.id!==expected[0]||!['DUE','UNCONFIRMED'].includes(item.state)||!Number.isFinite(Date.parse(item.dueAt))||Date.parse(item.dueAt)>now)return {kind:'clarify',message:'Choose the matching open, due occurrence. Future, closed and review-pending tasks cannot receive this activity.'};
 return {kind:command==='REPORT'?'report':'activity',loopId:item.loopId,status:expected[1],command,message:command==='REPORT'?'Choose a fictional report, check this task and confirm upload. A clinician must review it before closure.':'Check the activity status, time and description before confirming. This saves to the shared demo database.'};
}
export function eligibleTasks(items,now=Date.now()){
 return items.filter(i=>['DUE','UNCONFIRMED'].includes(i.state)&&Number.isFinite(Date.parse(i.dueAt))&&Date.parse(i.dueAt)<=now);
}
