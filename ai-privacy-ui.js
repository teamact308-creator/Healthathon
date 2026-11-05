import {minimizeText} from './supabase/functions/_shared/ai-privacy.mjs';

export function clearAITransfers(){globalThis.document?.querySelector('#ai-privacy-cancel')?.click();globalThis.document?.querySelector('[data-crop-cancel]')?.click();}

export function reviewAITransfer({text='',names=[],file=false,audio=false,notes=null,maxLength=2000}){
 return new Promise((resolve,reject)=>{
  const dialog=document.createElement('dialog');
  dialog.className='ai-transfer-review';
  dialog.setAttribute('aria-labelledby','ai-privacy-title');
  dialog.innerHTML='<h2 id="ai-privacy-title">Review what you share with AI</h2><p id="ai-privacy-description"></p><div id="ai-privacy-content"></div><p class="mini">Automatic removal can miss identifying details. Check the preview and keep the clinical instructions, dates and uncertainty accurate.</p><label class="consent"><input id="ai-privacy-agree" type="checkbox"> I reviewed this selection and agree to send it to OpenAI for this operation.</label><p id="ai-privacy-error" role="status"></p><div class="dialog-actions"><button type="button" id="ai-privacy-cancel" class="quiet">Cancel</button><button type="button" id="ai-privacy-send" class="primary">Continue</button></div>';
  const content=dialog.querySelector('#ai-privacy-content'),description=dialog.querySelector('#ai-privacy-description');
  description.textContent=audio?'Transcription sends the original recording, including any identifying details spoken in it. You can cancel and type a note instead.':file?'Choose whether to send your source note only or include the original prescription file.':'Only the reviewed text below will be used for this operation.';
  let editor,includeFile;
  const add=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;content.append(node);return node;};
  if(!audio&&!notes){
   const minimized=minimizeText(text,names);
   const label=add('label','Text to send');
   editor=document.createElement('textarea');editor.rows=7;editor.maxLength=maxLength;editor.spellcheck=false;editor.autocomplete='off';editor.setAttribute('data-gramm','false');editor.setAttribute('data-enable-grammarly','false');editor.value=minimized.text;label.append(editor);
   if(minimized.removed.length)add('p','Removed recognizable '+minimized.removed.join(', ')+'.');
  }
  if(file){
   const label=add('label','');
   includeFile=document.createElement('input');includeFile.type='checkbox';
   label.append(includeFile,document.createTextNode(' Include the original file. The entire file will be sent, including names or identifiers visible in it.'));
  }
  if(notes)for(const note of notes){
   const label=add('label','');
   label.className='event';
   const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=true;checkbox.dataset.noteId=note.id;
   const span=document.createElement('span');span.textContent=minimizeText(note.text,names).text;
   label.append(checkbox,span);label.style.display='block';
  }
  let finished=false;
  const finish=(result)=>{
   if(finished)return;finished=true;dialog.close();dialog.remove();
   result?resolve(result):reject(Error('AI processing cancelled.'));
  };
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
  dialog.querySelector('#ai-privacy-cancel').onclick=()=>finish(null);
  dialog.querySelector('#ai-privacy-send').onclick=()=>{
   const status=dialog.querySelector('#ai-privacy-error');
   if(!dialog.querySelector('#ai-privacy-agree').checked){status.textContent='Review the selection and tick the agreement to continue.';return;}
   const ids=notes?[...content.querySelectorAll('input:checked')].map(input=>input.dataset.noteId):null;
   const reviewed=editor?minimizeText(editor.value,names).text:'';
   if(notes&&!ids.length||!audio&&!notes&&!reviewed.trim()&&!includeFile?.checked){status.textContent='Choose a note, enter text, or include the original file.';return;}
   finish({text:reviewed,ids,includeFile:!!includeFile?.checked,privacy_version:1,privacy_request_id:crypto.randomUUID()});
  };
  document.body.append(dialog);dialog.showModal();
 });
}

export const recordingPrivacyPanel=()=>'<section class="card"><h2>Stored voice recordings</h2><p>Review recordings you uploaded to this workspace. You can permanently remove unused audio. Audio attached to saved activity is protected.</p><button type="button" class="quiet" id="voice-storage-load">Review my recordings</button><div id="voice-storage-list"></div><p id="voice-storage-status" role="status"></p><h3>Automatic cleanup</h3><p class="mini">Choose when your unused audio can be removed. Saved activity recordings are protected. Daily cleanup applies to new uploads unless you include existing unused audio.</p><label>Remove unused audio after<select id="voice-retention-days" disabled><option value="">Off</option><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option></select></label><label class="consent"><input type="checkbox" id="voice-retention-existing"> Include my existing unused recordings</label><button type="button" class="quiet" id="voice-retention-preview" disabled>Preview cleanup</button><button type="button" class="quiet" id="voice-retention-save" disabled>Save cleanup preference</button><p id="voice-retention-status" role="status"></p></section>';

export function bindRecordingPrivacy(root,{list,remove,previewRetention,saveRetention,setupRetention}){
 const load=root.querySelector('#voice-storage-load');
 if(!load)return;
 const days=root.querySelector('#voice-retention-days'),existing=root.querySelector('#voice-retention-existing'),preview=root.querySelector('#voice-retention-preview'),save=root.querySelector('#voice-retention-save'),retentionStatus=root.querySelector('#voice-retention-status');
 let previewed=false,scheduled=false;
 const invalidate=()=>{previewed=false;save.disabled=true;retentionStatus.textContent='Preview the cleanup before saving.';};
 days.onchange=invalidate;existing.onchange=invalidate;
 preview.onclick=async()=>{
  preview.disabled=true;save.disabled=true;
  const chosen=days.value,include=existing.checked;
  try{
   const result=await previewRetention(chosen?Number(chosen):null,include);
   if(!preview.isConnected)return;
   if(chosen!==days.value||include!==existing.checked)return;
   previewed=true;save.disabled=!result.worker_scheduled;
   if(!result.worker_scheduled){retentionStatus.textContent='Automatic cleanup setup is pending. Manual recording removal is available.';return;}
   retentionStatus.textContent=chosen?result.eligible+' existing unused recordings currently qualify. New unused audio will also qualify after '+chosen+' days.':'Automatic cleanup will be turned off. A removal already in progress may finish.';
  }catch(error){if(preview.isConnected)retentionStatus.textContent=error.message;}
  finally{preview.disabled=false;}
 };
 save.onclick=async()=>{
  if(!previewed)return;
  save.disabled=true;
  try{
   await saveRetention(days.value?Number(days.value):null,existing.checked);
   if(save.isConnected){previewed=false;retentionStatus.textContent='Cleanup preference saved. The daily worker checks enabled preferences.';}
  }catch(error){if(save.isConnected){save.disabled=false;retentionStatus.textContent=error.message;}}
 };
 const setup=document.createElement('button');
 setup.type='button';setup.className='quiet';setup.textContent='Enable daily cleanup service';setup.hidden=true;
 retentionStatus.before(setup);
 const loadPreference=async()=>{
  try{
   const result=await previewRetention(null,false);
   if(!days.isConnected)return;
   scheduled=!!result.worker_scheduled;
   days.value=result.policy_days==null?'':String(result.policy_days);
   days.disabled=false;preview.disabled=false;
   setup.hidden=scheduled||!setupRetention;
   retentionStatus.textContent=!scheduled?'Automatic cleanup setup is pending. Manual removal is available.':result.policy_days?'Your current cleanup period is '+result.policy_days+' days.':'Automatic cleanup is off. Preview and save a preference to enable it.';
  }catch(error){if(days.isConnected)retentionStatus.textContent=error.message;}
 };
 setup.onclick=async()=>{
  setup.disabled=true;
  try{
   await setupRetention();
   await loadPreference();
  }catch(error){if(setup.isConnected)retentionStatus.textContent=error.message;}
  finally{setup.disabled=false;}
 };
 if(previewRetention)void loadPreference();
 const box=root.querySelector('#voice-storage-list'),status=root.querySelector('#voice-storage-status');
 load.onclick=async()=>{
  load.disabled=true;
  try{
   const rows=await list();
   if(!box.isConnected)return;
   box.replaceChildren();
   if(!rows.length){status.textContent='No stored recordings uploaded by you.';return;}
   status.textContent=rows.length+' recordings loaded. Most recent first.';
   for(const row of rows){
    const article=document.createElement('article');article.className='event';
    const date=document.createElement('p');date.textContent=new Date(row.created_at).toLocaleString();
    const detail=document.createElement('p');detail.className='mini';detail.textContent=row.linked?'Attached to saved activity':'Unused recording';
    article.append(date,detail);
    if(!row.linked){
     const button=document.createElement('button');button.type='button';button.className='quiet';button.textContent='Remove audio';
     let armed=false;
     button.onclick=async()=>{
      if(!armed){armed=true;button.textContent='Confirm permanent removal';return;}
      button.disabled=true;
      try{await remove(row.path);article.remove();status.textContent='Audio removed from WholeCare storage.';}
      catch(error){if(box.isConnected){button.disabled=false;status.textContent=error.message;}}
     };
     article.append(button);
    }
    box.append(article);
   }
  }catch(error){if(box.isConnected)status.textContent=error.message;}
  finally{load.disabled=false;}
 };
}
