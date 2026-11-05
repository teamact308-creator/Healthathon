// Conservative substitutions. Clinical quantities, timing and uncertainty stay intact.
export const privacyVersion = 1;
export function minimizeText(value, names = []) {
 let text=String(value??'');
 const removed=[];
 const replace=(pattern,label)=>{
  text=text.replace(pattern,()=>{removed.push(label);return '['+label+' removed]';});
 };
 replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'email');
 replace(/\b(?:https?:\/\/|www\.)[^\s<>]+/gi,'link');
 replace(/(?:\+91[ -]?)?[6-9]\d{4}[ -]?\d{5}\b/g,'phone');
 replace(/\+\d{1,3}[ -]?(?:\d[ -]?){8,13}\d\b/g,'phone');
 replace(/\b(?:\d{4}[ -]){2}\d{4}\b/g,'identifier');
 replace(/(?:^|\n)[ \t]*(?:patient name|patient id|uhid|abha|aadhaar|address|phone|mobile|email)\s*[:=][^\n]*/gi,'identity field');
 for(const name of names){
  if(typeof name!=='string'||name.trim().length<5)continue;
  const escaped=name.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  replace(new RegExp('(?<![\\p{L}])'+escaped+'(?![\\p{L}])','giu'),'name');
 }
 return {text,removed:[...new Set(removed)]};
}
