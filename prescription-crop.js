export function cropBounds(width,height,rect){
 if(![width,height].every(Number.isFinite)||width<1||height<1)throw Error('Image dimensions are unavailable.');
 const {left,top,right,bottom}=rect;
 if(![left,top,right,bottom].every(Number.isFinite)||left<0||top<0||right>100||bottom>100||right<=left||bottom<=top)throw Error('Choose a crop with a right edge after the left edge and a bottom edge below the top.');
 const x=Math.floor(width*left/100),y=Math.floor(height*top/100);
 return {x,y,width:Math.max(1,Math.ceil(width*right/100)-x),height:Math.max(1,Math.ceil(height*bottom/100)-y)};
}

export async function cropPrescription(file){
 if(!['image/png','image/jpeg'].includes(file.type))throw Error('Choose a PNG or JPEG image to crop. PDFs can be uploaded as a source file.');
 const bitmap=await createImageBitmap(file);
 if(bitmap.width*bitmap.height>40000000){bitmap.close();throw Error('Use an image smaller than 40 megapixels.');}
 return new Promise((resolve,reject)=>{
  const dialog=document.createElement('dialog');dialog.setAttribute('aria-labelledby','prescription-crop-title');
  dialog.innerHTML='<h2 id="prescription-crop-title">Choose the prescription area</h2><p>Keep all medication instructions, doses, timing and hold/stop notes inside the selected area. You can exclude a name or address header. Cropping happens on your device.</p><canvas style="display:block;max-width:100%;height:auto"></canvas><fieldset><legend>Crop edges (% of image)</legend><label>Left<input name="left" type="number" min="0" max="99" value="0"></label><label>Top<input name="top" type="number" min="0" max="99" value="0"></label><label>Right<input name="right" type="number" min="1" max="100" value="100"></label><label>Bottom<input name="bottom" type="number" min="1" max="100" value="100"></label></fieldset><p role="status"></p><div class="dialog-actions"><button type="button" class="quiet" data-crop-cancel>Cancel</button><button type="button" class="primary" data-crop-apply>Use selected area</button></div>';
  const canvas=dialog.querySelector('canvas'),status=dialog.querySelector('[role=status]'),apply=dialog.querySelector('[data-crop-apply]');
  const scale=Math.min(1,600/bitmap.width,450/bitmap.height);
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const context=canvas.getContext('2d');
  const selected=()=>Object.fromEntries([...dialog.querySelectorAll('input')].map(input=>[input.name,Number(input.value)]));
  const draw=()=>{
   context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
   try{
    const rect=cropBounds(canvas.width,canvas.height,selected());
    context.fillStyle='rgba(0,0,0,.45)';
    context.fillRect(0,0,canvas.width,rect.y);
    context.fillRect(0,rect.y+rect.height,canvas.width,canvas.height-rect.y-rect.height);
    context.fillRect(0,rect.y,rect.x,rect.height);
    context.fillRect(rect.x+rect.width,rect.y,canvas.width-rect.x-rect.width,rect.height);
    context.strokeStyle='#e1943c';context.lineWidth=2;context.strokeRect(rect.x,rect.y,rect.width,rect.height);
    apply.disabled=false;status.textContent='';
   }catch(error){apply.disabled=true;status.textContent=error.message;}
  };
  let finished=false;
  const finish=value=>{if(finished)return;finished=true;bitmap.close();dialog.close();dialog.remove();resolve(value);};
  dialog.querySelector('[data-crop-cancel]').onclick=()=>finish(null);
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
  dialog.querySelectorAll('input').forEach(input=>input.oninput=draw);
  apply.onclick=()=>{
   try{
    const rect=cropBounds(bitmap.width,bitmap.height,selected());
    const output=document.createElement('canvas');output.width=rect.width;output.height=rect.height;
    output.getContext('2d').drawImage(bitmap,rect.x,rect.y,rect.width,rect.height,0,0,rect.width,rect.height);
    apply.disabled=true;
    output.toBlob(blob=>{
     if(finished)return;
     if(!blob||blob.size>8388608){apply.disabled=false;status.textContent='The crop must be under 8 MB. Choose a smaller source image.';return;}
     finish(new File([blob],'selected-prescription.png',{type:'image/png'}));
    },'image/png');
   }catch(error){status.textContent=error.message;}
  };
  document.body.append(dialog);dialog.showModal();draw();
 });
}
