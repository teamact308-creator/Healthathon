"""Exercise the pinned official Filly ASGI application without a server or provider."""
import argparse
import asyncio
import io
import json
import os
import pathlib
import sys
import wave

parser=argparse.ArgumentParser()
parser.add_argument('--source',required=True)
parser.add_argument('--synthetic-only',action='store_true',required=True)
args=parser.parse_args()
source=pathlib.Path(args.source).resolve()
if not (source/'app/main.py').is_file():
 raise SystemExit('Pinned Filly source directory required')
os.environ.update(FILLY_MOCK='1',FILLY_AUTH_TOKEN='local-synthetic-test-token',
 PUBLIC_BASE_URL='http://filly.test',GROQ_API_KEY='',SARVAM_API_KEY='',OPENAI_API_KEY='',
 PYTHON_DOTENV_DISABLED='1')
sys.path.insert(0,str(source))
import httpx
from app.main import app
from app import asr,extraction,config
from app.store import store

assert config.MOCK_MODE
assert not any([config.GROQ_API_KEY,config.SARVAM_API_KEY,config.OPENAI_API_KEY])
async def no_network(*args,**kwargs):
 raise AssertionError('A provider call was attempted in mock mode')
asr._client.post=no_network
extraction._client.post=no_network

async def check():
 headers={'Authorization':'Bearer local-synthetic-test-token'}
 checks={}
 audio=io.BytesIO()
 with wave.open(audio,'wb') as recording:
  recording.setnchannels(1)
  recording.setsampwidth(2)
  recording.setframerate(8000)
  recording.writeframes(bytes(160))
 async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://filly.test') as client:
  response=await client.post('/v1/sessions',json={})
  assert response.status_code==401
  checks['unauthenticated_session_denied']=True
  response=await client.post('/v1/sessions',headers=headers,json={'templates':['wholecare_eval'],'language_hint':['en']})
  assert response.status_code==200
  session=response.json()
  identifier=session['session_id']
  assert session.get('patient_details') is None
  checks['session_without_patient_identifiers']=True
  response=await client.post('/v1/upload/'+identifier,data={'key':'audio_0.wav','token':'invalid'},files={'file':('audio_0.wav',audio.getvalue(),'audio/wav')})
  assert response.status_code==401
  checks['invalid_upload_capability_denied']=True
  for index in [1,0]:
   response=await client.post('/v1/upload/'+identifier+'/audio_'+str(index)+'.wav',headers=headers,content=audio.getvalue())
   assert response.status_code==200
  response=await client.post('/v1/sessions/'+identifier+'/end',headers=headers,json={'audio_files_sent':2})
  assert response.status_code==200
  for _ in range(20):
   response=await client.get('/v1/sessions/'+identifier,headers=headers)
   result=response.json()
   if result['status']=='completed':break
   await asyncio.sleep(0.01)
  assert result['status']=='completed'
  assert result['transcript']=='[mock transcript for audio_0.wav] [mock transcript for audio_1.wav]'
  checks['chunks_assembled_in_order']=True
  assert result['templates'][0]['wholecare_eval']['status']=='success'
  checks['template_result_received']=True
  response=await client.get('/v1/sessions/'+identifier)
  assert response.status_code==401
  checks['unauthenticated_session_read_denied']=True
  store._sessions.clear()
 checks['provider_network_disabled']=True
 print(json.dumps({'mode':'official Filly mock, no accuracy claim','revision':'33a76c95325bfe72f4f20dbe53007e7993e36b68','checks':checks},indent=2))

asyncio.run(check())
