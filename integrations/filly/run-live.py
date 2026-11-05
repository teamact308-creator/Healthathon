import json,re,uuid,pathlib,urllib.request,urllib.error,asyncio,os,sys,time
root=pathlib.Path(__file__).resolve().parents[2]
cfg=(root/'db-config.js').read_text()
url=re.search("SUPABASE_URL='([^']+)'",cfg)[1]
key=re.search("SUPABASE_KEY='([^']+)'",cfg)[1]
folder=pathlib.Path(os.environ['FILLY_CORPUS_DIR']).resolve()
manifest=json.loads((folder/'manifest.json').read_text())
contract=json.loads((folder/'contract.json').read_text())
def call(path,body=None,token=None,method=None,mime='application/json'):
 headers={'apikey':key,'Content-Type':mime}
 if token:headers['Authorization']='Bearer '+token
 data=body if isinstance(body,bytes) else json.dumps(body).encode() if body is not None else None
 request=urllib.request.Request(url+path,data=data,headers=headers,method=method or ('POST' if body is not None else 'GET'))
 try:
  with urllib.request.urlopen(request,timeout=110) as response:
   raw=response.read()
   return response.status,json.loads(raw) if raw and 'json' in response.headers.get('content-type','') else None
 except urllib.error.HTTPError as error:
  raw=error.read()
  try:result=json.loads(raw)
  except Exception:result={}
  return error.code,result
status,session=call('/auth/v1/token?grant_type=password',{'email':os.environ['WHOLECARE_TEST_EMAIL'],'password':os.environ['WHOLECARE_TEST_PASSWORD']})
assert status==200
token=session['access_token']
status,context=call('/rest/v1/rpc/my_context',{},token)
patient=context['memberships'][0]['patient_id']
os.environ.update(FILLY_MOCK='0',ASR_PROVIDER='sarvam',SARVAM_API_KEY='server-relay-placeholder',SARVAM_ASR_MODE='transcribe',LLM_PROVIDER='openai',OPENAI_API_KEY='server-relay-placeholder',OPENAI_LLM_MODEL=contract['model'],PYTHON_DOTENV_DISABLED='1')
sys.path.insert(0,os.environ['FILLY_SOURCE_DIR'])
import httpx
from app import asr,extraction
results=[]
cached=None
current_path=None
async def relay_asr(endpoint,**kwargs):
 global cached
 assert endpoint=='https://api.sarvam.ai/speech-to-text'
 assert kwargs['data']['model']=='saaras:v3'
 assert kwargs['data']['mode']=='transcribe'
 status,cached=await asyncio.to_thread(call,'/functions/v1/filly-synthetic-trial',{'patient_id':patient,'provider':'sarvam','source_path':current_path,'synthetic_only':True,'approved':True,'privacy_version':1,'privacy_request_id':str(uuid.uuid4())},token)
 if status!=200:raise RuntimeError('Sarvam trial status '+str(status)+' '+str(cached.get('error')))
 return httpx.Response(200,json={'transcript':cached['transcript']},request=httpx.Request('POST',endpoint))
async def relay_extraction(endpoint,**kwargs):
 assert endpoint=='https://api.openai.com/v1/chat/completions'
 body=kwargs['json']
 assert body['model']==contract['model']
 assert body['messages']==extraction._build_messages(cached['transcript'],contract['template'],contract['example'])
 assert body['temperature']==0 and body['response_format']=={'type':'json_object'}
 return httpx.Response(200,json={'choices':[{'message':{'content':json.dumps(cached['data'],ensure_ascii=False)}}]},request=httpx.Request('POST',endpoint))
asr._client.post=relay_asr
extraction._client.post=relay_extraction
async def run():
 global cached,current_path
 for fixture in manifest:
  current_path=patient+'/'+str(uuid.uuid4())+'.wav'
  audio=(folder/(fixture['id']+'.wav')).read_bytes()
  status,_=call('/storage/v1/object/voice-notes/'+current_path,audio,token,mime='audio/wav')
  assert status==200
  try:
   for provider in ['sarvam','openai']:
    try:
     if provider=='sarvam':
      transcript=await asr.transcribe_chunk(audio,fixture['id']+'.wav',fixture['language'])
     else:
      status,cached=await asyncio.to_thread(call,'/functions/v1/filly-synthetic-trial',{'patient_id':patient,'provider':'openai','source_path':current_path,'synthetic_only':True,'approved':True,'privacy_version':1,'privacy_request_id':str(uuid.uuid4())},token)
      if status!=200:raise RuntimeError('OpenAI trial status '+str(status)+' '+str(cached.get('error')))
      transcript=cached['transcript']
     data=await extraction.extract_structured(transcript,contract['template'],contract['example'])
     assert data==cached['data']
     results.append({'fixture':fixture['id'],'script_id':fixture['script_id'],'condition':fixture['condition'],'expected_script':fixture['text'],'filly_client_verified':True,**cached})
     print(json.dumps({'fixture':fixture['id'],'provider':provider,'extraction_valid':cached['extraction_valid'],'reported_status':data.get('reported_status'),'asr_ms':cached['asr_ms']}),flush=True)
    except Exception as error:
     results.append({'fixture':fixture['id'],'provider':provider,'error':str(error)})
     print(json.dumps({'fixture':fixture['id'],'provider':provider,'error':str(error)}),flush=True)
    (folder/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
  finally:
   a,_=call('/rest/v1/rpc/prepare_voice_removal',{'p_patient':patient,'p_path':current_path},token)
   b,_=call('/storage/v1/object/voice-notes',{'prefixes':[current_path]},token,method='DELETE')
   assert a==200 and b==200
 await asr._client.aclose()
 await extraction._client.aclose()
 print(json.dumps({'completed':len(results),'failures':sum('error' in r for r in results),'temporary_uploads_removed':True}),flush=True)
asyncio.run(run())
