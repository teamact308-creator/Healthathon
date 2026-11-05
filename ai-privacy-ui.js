import {minimizeText} from './supabase/functions/_shared/ai-privacy.mjs';

export function reviewAITransfer({text='',names=[],file=false,audio=false,notes=null}){
 return new Promise((resolve,reject)=>{
  const dialog=document.createElement('dialog');
  dialog.setAttribute('aria-labelledby','ai-privacy-title');
  dialog.innerHTML='<h2 id="ai-privacy-title">Review what you share with AI</h2><p id="ai-privacy-description"></p><div id="ai-privacy-content"></div><p class="mini">Automatic removal can miss identifying details. Check the preview and keep the clinical instructions, dates and uncertainty accurate.</p><label class="consent"><input id="ai-privacy-agree" type="checkbox"> I reviewed this selection and agree to send it to OpenAI for this operation.</label><p id="ai-privacy-error" role="status"></p><div class="dialog-actions"><button type="button" id="ai-privacy-cancel" class="quiet">Cancel</button><button type="button" id="ai-privacy-send" class="primary">Continue</button></div>';
  const content=dialog.querySelector('#ai-privacy-content'),description=dialog.querySelector('#ai-privacy-description');
  description.textContent=audio?'Transcription sends the original recording, including any identifying details spoken in it. You can cancel and type a note instead.':file?'Choose whether to send your source note only or include the original prescription file.':'Only the reviewed text below will be used for this operation.';
  let editor,includeFile;
  const add=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;content.append(node);return node;};
  if(!audio&&!notes){
   const minimized=minimizeText(text,names);
   const label=add('label','Text to send');
   editor=document.createElement('textarea');editor.rows=7;editor.maxLength=20000;editor.value=minimized.text;label.append(editor);
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

export const recordingPrivacyPanel=()=>'<section class="card"><h2>Stored voice recordings</h2><p>Review recordings you uploaded to this workspace. You can permanently remove unused audio. Audio attached to saved activity is protected.</p><button type="button" class="quiet" id="voice-storage-load">Review my recordings</button><div id="voice-storage-list"></div><p id="voice-storage-status" role="status"></p></section>';

export function bindRecordingPrivacy(root,{list,remove}){
 const load=root.querySelector('#voice-storage-load');
 if(!load)return;
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
