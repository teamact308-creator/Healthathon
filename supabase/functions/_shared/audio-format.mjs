// Preserve the actual container when naming provider multipart uploads.
export function audioFormat(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input);const ascii=(a,z)=>String.fromCharCode(...b.slice(a,z));
 if(b.length<12)throw Error('Recording is incomplete');
 if(ascii(0,4)==='RIFF'&&ascii(8,12)==='WAVE')return {mime:'audio/wav',extension:'wav'};
 if(b[0]===0x1a&&b[1]===0x45&&b[2]===0xdf&&b[3]===0xa3)return {mime:'audio/webm',extension:'webm'};
 if(ascii(0,3)==='ID3'||b[0]===255&&(b[1]&224)===224)return {mime:'audio/mpeg',extension:'mp3'};
 if(ascii(4,8)==='ftyp')return {mime:'audio/mp4',extension:'m4a'};
 throw Error('Use a supported WAV, WebM, MP3 or MP4 recording');
}
