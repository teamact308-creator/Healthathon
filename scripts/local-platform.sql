-- Disposable PostgreSQL test harness ONLY; never apply to hosted Supabase.
-- Minimal platform contracts used by application migrations, not a GoTrue/Storage service emulator.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
alter default privileges in schema public grant execute on functions to service_role;
alter default privileges in schema public grant all on tables to service_role;
create schema auth;
create schema storage;
create table auth.users(id uuid primary key,email text unique);
create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'))::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim',true),''),nullif(current_setting('request.jwt.claims',true),''))::jsonb$$;
grant usage on schema auth to anon,authenticated,service_role;
grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;
create table storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text not null,owner uuid,owner_id text,created_at timestamptz not null default now(),unique(bucket_id,name));
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated,service_role;
grant select,insert,update,delete on storage.objects to authenticated,service_role;
create function storage.foldername(name text) returns text[] language plpgsql immutable as $$declare parts text[];begin parts:=string_to_array(name,'/');return parts[1:array_length(parts,1)-1];end$$;
create schema supabase_migrations;
create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);

-- Offline-only Vault/pg_net contracts. Never install this fixture in hosted Supabase.
-- These fixtures cannot transmit HTTP and hold fictional secrets only.
create schema extensions;
create schema vault;
create table vault.secrets(id uuid primary key default gen_random_uuid(),name text unique,secret text);
create view vault.decrypted_secrets as select id,name,secret as decrypted_secret from vault.secrets;
create function vault.create_secret(new_secret text,new_name text default null,new_description text default '') returns uuid language plpgsql as $$declare result uuid;begin insert into vault.secrets(name,secret) values(new_name,new_secret) returning id into result;return result;end$$;
revoke all on schema vault from public,anon,authenticated;
revoke all on all tables in schema vault from public,anon,authenticated;
revoke all on all functions in schema vault from public,anon,authenticated;
create schema net;
create function net.http_post(url text,body jsonb default '{}'::jsonb,params jsonb default '{}'::jsonb,headers jsonb default '{"Content-Type":"application/json"}'::jsonb,timeout_milliseconds integer default 5000) returns bigint language plpgsql as $$begin raise exception 'Network is disabled in the disposable SQL fixture';end$$;
revoke all on schema net from public,anon,authenticated;
revoke all on all functions in schema net from public,anon,authenticated;
