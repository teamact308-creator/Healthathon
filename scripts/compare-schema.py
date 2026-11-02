"""Compare application schema snapshots, ignoring owner role names in ACLs."""
import json,pathlib,re,sys
left=json.loads(pathlib.Path(sys.argv[1]).read_text());right=json.loads(pathlib.Path(sys.argv[2]).read_text())
def normalized(data):
 data=json.loads(json.dumps(data))
 for f in data.get('functions',[]):
  f['source']=re.sub(r'\s+',' ',f['source']).strip()
  if f.get('acl'):
   entries=f['acl'].strip('{}').split(',');owner=entries[0].split('/')[-1]
   f['acl']=sorted(e.replace('/'+owner,'/OWNER').replace(owner+'=','OWNER=') for e in entries)
 for kind,rows in data.items():
  if isinstance(rows,list):data[kind]=sorted(rows,key=lambda x:json.dumps(x,sort_keys=True))
 return data
a,b=normalized(left),normalized(right);different={}
for key in a.keys()|b.keys():
 if a.get(key)!=b.get(key):
  x=[v for v in a.get(key,[]) if v not in b.get(key,[])];y=[v for v in b.get(key,[]) if v not in a.get(key,[])]
  different[key]={'left_only':x,'right_only':y}
print(json.dumps(different,indent=2));sys.exit(bool(different))
