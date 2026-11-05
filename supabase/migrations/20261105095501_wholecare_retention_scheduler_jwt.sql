create or replace function public.install_voice_retention_worker(p_token text,p_url text,p_anon text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare job bigint; scheduler_jwt text;
begin
 select decrypted_secret into scheduler_jwt from vault.decrypted_secrets where name='wholecare_retention_scheduler_jwt';
 if scheduler_jwt is null or scheduler_jwt not like 'eyJ%' then raise exception 'Configure the public scheduler JWT in Vault';end if;
 if p_url<>'https://gylnitduoasmybadblcp.supabase.co' or length(p_token)<64 or length(p_anon)<20 then raise exception 'Invalid worker configuration';end if;
 if not exists(select 1 from vault.secrets where name='wholecare_retention_token') then
  perform vault.create_secret(p_token,'wholecare_retention_token');
  perform vault.create_secret(scheduler_jwt,'wholecare_retention_anon');
 end if;
 select cron.schedule('wholecare-voice-retention','15 2 * * *',$job$
 select net.http_post(
  url:='https://gylnitduoasmybadblcp.supabase.co/functions/v1/voice-retention',
  headers:=jsonb_build_object('Content-Type','application/json',
   'apikey',(select decrypted_secret from vault.decrypted_secrets where name='wholecare_retention_anon'),
   'Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='wholecare_retention_anon'),
   'x-retention-token',(select decrypted_secret from vault.decrypted_secrets where name='wholecare_retention_token')),
  body:='{}'::jsonb
 );$job$) into job;
 return jsonb_build_object('scheduled',true,'job_id',job);
end$$;

