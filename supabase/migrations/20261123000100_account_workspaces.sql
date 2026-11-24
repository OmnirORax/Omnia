-- V2 snapshots have a separate format and owner; retained V1 accounts/assets are unchanged.
create table public.omnium_account_workspaces(
 workspace_id uuid primary key references public.workspaces(id) on delete cascade,
 revision bigint not null check(revision>0),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=10400000),
 request_id uuid not null,updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now()
);
alter table public.omnium_account_workspaces enable row level security;
revoke all on public.omnium_account_workspaces from public,anon,authenticated;
grant select on public.omnium_account_workspaces to authenticated;
grant all on public.omnium_account_workspaces to service_role;
create policy account_workspace_read on public.omnium_account_workspaces for select to authenticated using((select private.workspace_role(workspace_id)) is not null);
create function public.save_account_workspace(p_workspace uuid,p_actor uuid,p_expected bigint,p_request uuid,p_snapshot jsonb)
returns public.omnium_account_workspaces language plpgsql security definer set search_path='' as $$
declare result public.omnium_account_workspaces;image jsonb;
begin
 perform 1 from public.workspaces where id=p_workspace for update;
 if not exists(select from public.workspace_members where workspace_id=p_workspace and user_id=p_actor and role in ('owner','editor')) then raise sqlstate '42501' using message='forbidden';end if;
 if p_expected is null or p_expected<0 or p_request is null or p_snapshot is null or p_snapshot->>'format' is distinct from 'omnium-v2-private-workspace' or p_snapshot->>'version' is distinct from '1' or jsonb_typeof(p_snapshot->'world') is distinct from 'object' or jsonb_typeof(p_snapshot->'images') is distinct from 'array' or octet_length(p_snapshot::text)>10400000 then raise sqlstate '22023' using message='invalid_input';end if;
 select * into result from public.omnium_account_workspaces where workspace_id=p_workspace;
 if found and result.request_id=p_request then
  if result.updated_by<>p_actor or result.snapshot<>p_snapshot then raise sqlstate '23505' using message='conflict';end if;return result;
 end if;
 if coalesce(result.revision,0)<>p_expected then raise sqlstate '23505' using message='conflict';end if;
 for image in select value from jsonb_array_elements(p_snapshot->'images') loop
  perform 1 from public.assets where id=(image->>'assetId')::uuid and workspace_id=p_workspace and state='ready' for update;
  if not found then raise sqlstate '22023' using message='missing_private_image';end if;
 end loop;
 insert into public.omnium_account_workspaces(workspace_id,revision,snapshot,request_id,updated_by) values(p_workspace,p_expected+1,p_snapshot,p_request,p_actor)
 on conflict(workspace_id) do update set revision=excluded.revision,snapshot=excluded.snapshot,request_id=excluded.request_id,updated_by=excluded.updated_by,updated_at=now() returning * into result;
 return result;
end;$$;
revoke all on function public.save_account_workspace(uuid,uuid,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_account_workspace(uuid,uuid,bigint,uuid,jsonb) to service_role;

-- Reject deletion before Storage removes any bytes, rather than failing afterward.
create function private.protect_account_workspace_image() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='DELETE' or NEW.state='deleting' then
  if exists(select from public.omnium_account_workspaces where workspace_id=OLD.workspace_id and snapshot->'images' @> jsonb_build_array(jsonb_build_object('assetId',OLD.id::text))) then raise sqlstate '23503' using message='private_workspace_image_in_use';end if;
 end if;
 if TG_OP='DELETE' then return OLD;end if;return NEW;
end;$$;
revoke all on function private.protect_account_workspace_image() from public,anon,authenticated;
create trigger protect_account_workspace_image before update of state or delete on public.assets for each row execute function private.protect_account_workspace_image();
