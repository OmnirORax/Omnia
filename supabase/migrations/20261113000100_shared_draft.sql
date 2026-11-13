create table if not exists public.omnium_site_draft(id integer primary key check(id=1),revision bigint not null default 0,world jsonb not null,previous_world jsonb,updated_at timestamptz not null default now());
create table if not exists public.omnium_draft_assets(id text primary key,name text not null,type text not null,data text not null,size integer not null check(size>0 and size<=10485760));
alter table public.omnium_site_draft enable row level security;
alter table public.omnium_draft_assets enable row level security;
revoke all on public.omnium_site_draft,public.omnium_draft_assets from anon,authenticated;
grant select,insert,update on public.omnium_site_draft,public.omnium_draft_assets to service_role;
create or replace function public.omnium_put_draft_asset(asset_id text,asset_name text,asset_type text,asset_data text,asset_size integer) returns void language plpgsql set search_path=public as $$
begin
 perform 1 from omnium_site_draft where id=1 for update;
 insert into omnium_draft_assets values(asset_id,asset_name,asset_type,asset_data,asset_size) on conflict(id) do nothing;
 if (select count(*)>100 or coalesce(sum(size),0)>104857600 from omnium_draft_assets) then raise exception 'Draft image library is full';end if;
end;$$;
create or replace function public.omnium_save_draft(expected bigint,snapshot jsonb) returns bigint language plpgsql set search_path=public as $$
declare result bigint; missing boolean;
begin
 perform 1 from omnium_site_draft where id=1 for update;
 if not exists(select 1 from omnium_site_draft where id=1 and revision=expected) then return null;end if;
 if octet_length(snapshot::text)>4000000 or snapshot->>'format'<>'omnium-world' or snapshot->>'version'<>'2' then raise exception 'Invalid draft';end if;
 select exists(select 1 from (select snapshot#>>'{scene,image}' as image union select n->>'scene' from jsonb_array_elements(snapshot->'nodes') n) r where image is not null and not exists(select 1 from omnium_draft_assets a where a.id=r.image)) into missing;
 if missing then raise exception 'Draft image missing';end if;
 update omnium_site_draft set previous_world=world,world=snapshot,revision=revision+1,updated_at=now() where id=1 returning revision into result;
 return result;
end;$$;
revoke all on function public.omnium_put_draft_asset(text,text,text,text,integer),public.omnium_save_draft(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.omnium_put_draft_asset(text,text,text,text,integer),public.omnium_save_draft(bigint,jsonb) to service_role;
