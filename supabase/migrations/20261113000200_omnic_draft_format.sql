create or replace function public.omnium_save_draft(expected bigint,snapshot jsonb) returns bigint language plpgsql set search_path=public as $$
declare result bigint; missing boolean;
begin
 perform 1 from omnium_site_draft where id=1 for update;
 if not exists(select 1 from omnium_site_draft where id=1 and revision=expected) then return null;end if;
 if octet_length(snapshot::text)>4000000 or coalesce(snapshot->>'format','')<>'omnium-world' or coalesce(snapshot->>'version','') not in ('2','3') then raise exception 'Invalid draft';end if;
 if snapshot->>'version'='2' and exists(select 1 from omnium_site_draft where id=1 and world->>'version'='3') then raise exception 'Open the latest Omnium build before pushing this draft';end if;
 select exists(select 1 from (select snapshot#>>'{scene,image}' as image union select n->>'scene' from jsonb_array_elements(snapshot->'nodes') n) r where image is not null and not exists(select 1 from omnium_draft_assets a where a.id=r.image)) into missing;
 if missing then raise exception 'Draft image missing';end if;
 update omnium_site_draft set previous_world=world,world=snapshot,revision=revision+1,updated_at=now() where id=1 returning revision into result;
 return result;
end;$$;
