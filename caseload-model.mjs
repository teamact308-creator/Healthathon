export function selectMembership(context,selection){
 const memberships=context?.memberships||[];
 if(!memberships.length)throw Error('Your account has no assigned care workspace.');
 if(selection){const found=memberships.find(m=>m.patient_id===selection.patient_id&&m.role===selection.role);if(!found)throw Object.assign(Error('The selected patient is no longer assigned to you. Sign out and sign in to choose an available workspace.'),{status:403,code:'WORKSPACE_REVOKED'});return found;}
 return [...memberships].sort((a,b)=>a.patient_id.localeCompare(b.patient_id)||a.role.localeCompare(b.role))[0];
}
export function filterCaseload(rows,{search='',filter='all'}={}){
 const query=search.trim().toLocaleLowerCase();
 return rows.filter(p=>(!query||[p.display_name,p.patient_id,p.language].join(' ').toLocaleLowerCase().includes(query))&&
 (filter==='all'||filter==='overdue'&&p.overdue>0||filter==='review'&&p.review_pending>0||filter==='help'&&p.help_waiting>0))
 .sort((a,b)=>(b.review_pending+b.help_waiting+b.overdue)-(a.review_pending+a.help_waiting+a.overdue)||a.display_name.localeCompare(b.display_name));
}
export function caseloadTotals(rows){return rows.reduce((a,p)=>({patients:a.patients+1,overdue:a.overdue+p.overdue,review:a.review+p.review_pending,help:a.help+p.help_waiting}),{patients:0,overdue:0,review:0,help:0});}
