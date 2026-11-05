// Refresh only when no form or recording is being edited; never replace unsaved input.
export function mayRefresh({busy=false,hidden=false,dialog=false,dirty=false,view=''}){return !busy&&!hidden&&!dialog&&!dirty&&!['plans','capture','context','account'].includes(view);}
export function updateCheck({read,onChanged,onDenied,canCheck,interval=30000}){
 let revision=null,running=false,stopped=false;
 const tick=async()=>{
  if(stopped||running||!canCheck())return;
  running=true;
  try{const next=await read();if(stopped)return;if(revision!==null&&next!==revision)await onChanged();revision=next;}
  catch(error){if(error?.status===401||error?.status===403)onDenied(error);}
  finally{running=false;}
 };
 const timer=setInterval(tick,interval);
 return {tick,reset:()=>{revision=null;},stop:()=>{stopped=true;clearInterval(timer);}};
}
