"""Rebuild application migrations on disposable PostgreSQL, then dump/restore to a second cluster.
Requires PostgreSQL 17 and real pg_cron. No remote connections, credentials, HTTP calls or real data.
Platform Auth/Storage table/function contracts are minimal local fixtures, not running Supabase services.
"""
import argparse,json,os,pathlib,shutil,subprocess,tempfile,time
root=pathlib.Path(__file__).resolve().parent.parent
(root/'.local').mkdir(exist_ok=True)
parser=argparse.ArgumentParser();parser.add_argument('--pg-bin',default='/opt/homebrew/opt/postgresql@17/bin');parser.add_argument('--live-snapshot');args=parser.parse_args()
pg=pathlib.Path(args.pg_bin);report={'postgres_version':None,'migrations':[],'checks':[],'platform_scope':'Minimal Auth/Storage/Vault SQL contracts and a fail-closed offline pg_net fixture; real PostgreSQL and pg_cron. No GoTrue, object bytes, vault encryption, Edge Functions or HTTP delivery restored.'}
for binary in ['initdb','pg_ctl','psql','pg_dump','pg_restore']:
 if not (pg/binary).is_file():raise SystemExit('Missing PostgreSQL tool: '+str(pg/binary))
work=pathlib.Path(tempfile.mkdtemp(prefix='wholecare-rebuild-'));os.chmod(work,0o700);clusters=[]
def run(binary,params,sql=None):
 result=subprocess.run([str(pg/binary),*map(str,params)],input=sql,text=True,capture_output=True)
 if result.returncode:raise RuntimeError(binary+' failed:\n'+result.stderr[-5000:])
 return result.stdout

def cluster(name):
 d=work/name;d.mkdir();socket=d/'sock';socket.mkdir();data=d/'data'
 run('initdb',['-D',data,'--auth-local=trust','--auth-host=reject','--no-locale','-E','UTF8'])
 with (data/'postgresql.conf').open('a') as f:f.write("\nlisten_addresses=''\nunix_socket_directories='"+str(socket)+"'\nshared_preload_libraries='pg_cron'\ncron.database_name='postgres'\ncron.launch_active_jobs=off\n")
 run('pg_ctl',['-D',data,'-l',d/'server.log','-w','start']);clusters.append(data);return socket

def sql(socket,text):return run('psql',['-X','-h',socket,'-d','postgres','-v','ON_ERROR_STOP=1','-At'],text)
try:
 first=cluster('build');report['postgres_version']=sql(first,'show server_version;').strip()
 sql(first,(root/'scripts/local-platform.sql').read_text())
 for f in sorted((root/'supabase/migrations').glob('*.sql')):
  migration_sql=f.read_text()
  if f.name=='20261105090053_wholecare_voice_retention.sql':
   platform_extension='create extension if not exists pg_net with schema extensions;'
   if migration_sql.count(platform_extension)!=1:raise RuntimeError('Unexpected pg_net migration contract')
   migration_sql=migration_sql.replace(platform_extension,'-- pg_net supplied by the explicit offline local platform fixture.')
   report['checks'].append('pg_net extension DDL uses a documented offline platform fixture; all application DDL replayed')
  sql(first,migration_sql);version,name=f.stem.split('_',1)
  sql(first,"insert into supabase_migrations.schema_migrations(version,name) values('"+version+"','"+name+"');")
  report['migrations'].append(f.name)
 # Fixture identities are local SQL-contract rows, not production onboarding instructions.
 sql(first,"insert into auth.users(id,email) select gen_random_uuid(),email from unnest(array['patient@wholecare.test','clinician@wholecare.test','coordinator@wholecare.test','caregiver@wholecare.test']) email;")
 sql(first,(root/'database/seed.sql').read_text())
 for f in ['verify-capture.sql','verify-operations.sql','verify-bucket-three.sql','verify-vcpi.sql','verify-demo-journey.sql','verify-demo-provision.sql','verify-operational-controls.sql']:
  sql(first,(root/'database'/f).read_text());report['checks'].append('clean rebuild: '+f)
 sql(first,'begin;\n'+(root/'database/demo-multiple-patients.sql').read_text()+'\n'+(root/'database/verify-multi-patient.sql').read_text()+'\nrollback;')
 report['checks'].append('multi-patient caseload, patient isolation and immediate assignment revocation')
 snapshot=json.loads(sql(first,(root/'scripts/schema-snapshot.sql').read_text()).strip());(work/'rebuilt-schema.json').write_text(json.dumps(snapshot))
 if args.live_snapshot:
  result=subprocess.run(['python3',str(root/'scripts/compare-schema.py'),args.live_snapshot,str(work/'rebuilt-schema.json')],capture_output=True,text=True)
  (root/'.local/rebuild-schema-diff.json').write_text(result.stdout)
  if result.returncode:raise RuntimeError('Schema drift detected; see .local/rebuild-schema-diff.json')
  report['checks'].append('live application schema equals replayed application schema')
 dump=work/'wholecare.dump';run('pg_dump',['-h',first,'-d','postgres','-Fc','-f',dump])
 second=cluster('restore')
 # Roles are cluster-global and intentionally carry no passwords or remote identities.
 sql(second,'create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;')
 run('pg_restore',['-h',second,'-d','postgres','--exit-on-error',dump])
 restored=json.loads(sql(second,(root/'scripts/schema-snapshot.sql').read_text()).strip());(work/'restored-schema.json').write_text(json.dumps(restored))
 diff=subprocess.run(['python3',str(root/'scripts/compare-schema.py'),str(work/'rebuilt-schema.json'),str(work/'restored-schema.json')],capture_output=True,text=True)
 if diff.returncode:raise RuntimeError('Restored schema differs: '+diff.stdout[:3000])
 for f in ['verify-capture.sql','verify-operations.sql','verify-bucket-three.sql','verify-vcpi.sql','verify-demo-journey.sql','verify-demo-provision.sql','verify-operational-controls.sql']:
  sql(second,(root/'database'/f).read_text());report['checks'].append('restored database: '+f)
 before=sql(first,"select (select count(*) from public.care_loops),(select count(*) from public.patients),(select count(*) from public.glucose_observations);")
 after=sql(second,"select (select count(*) from public.care_loops),(select count(*) from public.patients),(select count(*) from public.glucose_observations);")
 if before!=after:raise RuntimeError('Restored synthetic data counts differ')
 report['checks'].append('dump/restore preserves schema, grants and synthetic fixture counts')
 report['status']='passed';(root/'.local/rebuild-verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
finally:
 for d in reversed(clusters):
  try:run('pg_ctl',['-D',d,'-m','fast','-w','stop'])
  except Exception:pass
 # Only this script's temporary synthetic clusters are removed.
 shutil.rmtree(work)
