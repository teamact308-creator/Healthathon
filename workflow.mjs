export const seed = () => ({version:1,consent:true,items:[
 {id:'med',domain:'Medication',label:'Morning medication routine',detail:'Confirm your routine from the agreed care plan.',time:'08:00',state:'UNCONFIRMED',owner:'Patient'},
 {id:'meal',domain:'Meals',label:'Breakfast check-in',detail:'Log breakfast as agreed with your care team.',time:'09:00',state:'DUE',owner:'Patient'},
 {id:'cgm',domain:'Glucose data',label:'Monitoring data sync',detail:'Synthetic readings · availability only',time:'10:00',state:'DUE',owner:'Patient'},
 {id:'test',domain:'Tests',label:'Renal-function investigation',detail:'Attach the sample report, then send it for clinician review.',time:'11:00',state:'DUE',owner:'Patient'}],audit:[],messages:[],processed:[]});
export function transition(s,{id,action,role,eventId,note=''}){
 if(!eventId)throw Error('An event ID is required.');
 if(s.processed.includes(eventId))return s;
 const item=s.items.find(i=>i.id===id);if(!item)throw Error('Unknown care item.');
 let next=item.state,owner=item.owner,extra={};
 if(action==='remind' && role==='Coordinator' && ['DUE','UNCONFIRMED'].includes(item.state)){
  extra.reminded=true;
 }else if(action==='support' && role==='Coordinator' && s.consent && item.reminded && item.owner==='Patient' && ['DUE','UNCONFIRMED'].includes(item.state)){
  owner='Caregiver';
 }else if(action==='complete' && role==='Patient' && ['med','meal','cgm'].includes(id) && ['DUE','UNCONFIRMED'].includes(item.state)){
  next='CLOSED';owner='None';
 }else if(action==='evidence' && role==='Patient' && id==='test' && item.state==='DUE'){
  next='REVIEW_PENDING';owner='Clinician';extra.evidence='Synthetic renal-function report · demo fixture';
 }else if(action==='review' && role==='Clinician' && id==='test' && item.state==='REVIEW_PENDING' && note.trim()){
  next='CLOSED';owner='None';extra.reviewNote=note.trim();
 }else if(action==='reopen' && role==='Clinician' && item.state==='CLOSED' && note.trim()){
  next=id==='med'?'UNCONFIRMED':'DUE';owner='Patient';extra={reminded:false,evidence:null,reviewNote:null};
 }else throw Error('This action is not available for the current role or state.');
 const event={eventId,id,action,role,from:item.state,to:next,previousOwner:item.owner,owner,note:note.trim(),at:new Date().toISOString()};
 return {...s,processed:[...s.processed,eventId],items:s.items.map(i=>i.id===id?{...i,...extra,state:next,owner}:i),audit:[event,...s.audit],messages:action==='remind'?[...s.messages,{text:`Reminder: ${item.label}. Please confirm or ask for help.`,to:'Patient',at:event.at}]:action==='support'?[...s.messages,{text:`Please help Anita with: ${item.label}.`,to:'Caregiver',at:event.at}]:s.messages};
}
