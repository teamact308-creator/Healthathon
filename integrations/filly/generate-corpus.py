import json,pathlib,subprocess,wave,random,math,array,hashlib
import sys
root=pathlib.Path(sys.argv[1]).resolve()
root.mkdir(parents=True,exist_ok=True)
scripts=json.loads((root/'scripts.json').read_text())
manifest=[]
for fixture in scripts:
 name=fixture['id']
 voice='Lekha' if name.endswith('-hi') else 'Samantha'
 aiff=root/(name+'.aiff');wav=root/(name+'.wav')
 subprocess.run(['say','-v',voice,'-o',str(aiff),fixture['text']],check=True)
 subprocess.run(['afconvert','-f','WAVE','-d','LEI16@16000','-c','1',str(aiff),str(wav)],check=True)
 with wave.open(str(wav),'rb') as recording:
  params=recording.getparams();samples=array.array('h',recording.readframes(recording.getnframes()))
 if not samples:raise RuntimeError('Speech synthesis produced empty audio')
 duration=len(samples)/16000
 rms=math.sqrt(sum(sample*sample for sample in samples)/len(samples))
 rng=random.Random(4721)
 noise_sigma=rms/(10**(10/20))
 noisy=array.array('h',(max(-32768,min(32767,round(sample+rng.gauss(0,noise_sigma)))) for sample in samples))
 noisy_path=root/(name+'-noise.wav')
 with wave.open(str(noisy_path),'wb') as recording:recording.setparams(params);recording.writeframes(noisy.tobytes())
 for path,condition in [(wav,'clean'),(noisy_path,'synthetic white noise, nominal 10 dB SNR')]:
  manifest.append({'id':path.stem,'script_id':name,'text':fixture['text'],'language':'hi' if name.endswith('-hi') else 'en','condition':condition,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,'seconds':duration,'voice':voice})
(root/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print(json.dumps({'fixtures':len(manifest),'total_seconds':sum(f['seconds'] for f in manifest),'all_nonempty':all(f['seconds']>0 for f in manifest)}))
