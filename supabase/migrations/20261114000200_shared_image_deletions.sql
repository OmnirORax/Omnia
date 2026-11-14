alter table public.omnium_draft_assets add column delete_requested boolean not null default false;
create or replace function public.omnium_prune_draft_assets() returns bigint
language plpgsql set search_path=public as $$
declare removed bigint;
begin
 perform 1 from omnium_site_draft where id=1 for update;
 with refs as materialized (select image from omnium_site_draft d cross join lateral (
  select image from omnium_draft_image_refs(d.world)
  union select image from omnium_draft_image_refs(d.previous_world)
 ) r)
 delete from omnium_draft_assets a where (a.delete_requested or a.uploaded_at<now()-interval '30 minutes')
 and not exists(select 1 from refs r where r.image=a.id);
 get diagnostics removed=row_count;
 return removed;
end;$$;

create or replace function public.omnium_put_draft_asset(asset_id text,asset_name text,asset_type text,asset_data text,asset_size integer) returns void
language plpgsql set search_path=public as $$
begin
 perform 1 from omnium_site_draft where id=1 for update;
 perform omnium_prune_draft_assets();
 insert into omnium_draft_assets(id,name,type,data,size) values(asset_id,asset_name,asset_type,asset_data,asset_size)
 on conflict(id) do update set uploaded_at=now(),delete_requested=false;
 -- Each snapshot has its own budget. Staging also has a bounded budget, so
 -- current + recovery + in-flight uploads use at most 300 images / 300 MiB.
 if (with refs as materialized (select image from omnium_site_draft d cross join lateral (
  select image from omnium_draft_image_refs(d.world)
  union select image from omnium_draft_image_refs(d.previous_world)
 ) r) select count(*)>100 or coalesce(sum(a.size),0)>104857600 from omnium_draft_assets a
 where not exists(select 1 from refs r where r.image=a.id)) then raise exception 'Draft image library is full';end if;
end;$$;

-- Keep old two-argument callers working through the new argument's default.
drop function public.omnium_save_draft(bigint,jsonb);
create function public.omnium_save_draft(expected bigint,snapshot jsonb,deleted_images text[] default '{}'::text[]) returns bigint
language plpgsql set search_path=public as $$
declare result bigint;
begin
 perform 1 from omnium_site_draft where id=1 for update;
 if not exists(select 1 from omnium_site_draft where id=1 and revision=expected) then return null;end if;
 if octet_length(snapshot::text)>4000000 or coalesce(snapshot->>'format','')<>'omnium-world' or coalesce(snapshot->>'version','') not in ('2','3') then raise exception 'Invalid draft';end if;
 if cardinality(deleted_images)>1000 or exists(select 1 from unnest(deleted_images) image where image is null or image!~'^sha256:[a-f0-9]{64}$') then raise exception 'Invalid image deletions';end if;
 if snapshot->>'version'='2' and exists(select 1 from omnium_site_draft where id=1 and world->>'version'='3') then raise exception 'Open the latest Omnium build before pushing this draft';end if;
 if exists(select 1 from omnium_draft_image_refs(snapshot) r where r.image=any(deleted_images)) then raise exception 'Deleted image still used by draft';end if;
 if exists(select 1 from omnium_draft_image_refs(snapshot) r where not exists(select 1 from omnium_draft_assets a where a.id=r.image)) then raise exception 'Draft image missing';end if;
 if (select count(*)>100 or coalesce(sum(a.size),0)>104857600 from omnium_draft_assets a join omnium_draft_image_refs(snapshot) r on r.image=a.id) then raise exception 'Draft images exceed workspace limit';end if;
 update omnium_site_draft set previous_world=world,world=snapshot,revision=revision+1,updated_at=now() where id=1 returning revision into result;
 -- Remember deletions even when recovery still holds the image.
 update omnium_draft_assets set delete_requested=true where id=any(deleted_images);
 perform omnium_prune_draft_assets();
 return result;
end;$$;

revoke all on function public.omnium_save_draft(bigint,jsonb,text[]) from public,anon,authenticated;
grant execute on function public.omnium_save_draft(bigint,jsonb,text[]) to service_role;
