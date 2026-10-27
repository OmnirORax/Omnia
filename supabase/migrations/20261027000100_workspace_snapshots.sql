-- Explicit workspace snapshots. Existing auth, membership and assets stay intact.
create table public.workspace_snapshots (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  version bigint not null check (version > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 9000000),
  request_id uuid not null,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.workspace_snapshots enable row level security;
revoke all on public.workspace_snapshots from anon, authenticated;
grant select on public.workspace_snapshots to authenticated;
grant all on public.workspace_snapshots to service_role;
create policy workspace_snapshot_read on public.workspace_snapshots for select to authenticated
using ((select private.workspace_role(workspace_id)) is not null);

-- Only the validated Edge handler can write snapshots. Recheck membership inside
-- the locked transaction, and use a server token independent of local revisions.
create function public.save_workspace_snapshot(p_workspace uuid,p_actor uuid,p_expected bigint,p_request uuid,p_snapshot jsonb)
returns public.workspace_snapshots language plpgsql security definer set search_path = '' as $$
declare result public.workspace_snapshots;
begin
  perform 1 from public.workspaces where id=p_workspace for update;
  if not exists(select 1 from public.workspace_members where workspace_id=p_workspace and user_id=p_actor and role in ('owner','editor')) then
    raise sqlstate '42501' using message='forbidden';
  end if;
  if p_expected is null or p_expected < 0 or p_request is null or p_snapshot is null
    or p_snapshot->>'format' is distinct from 'omnium-workspace' or p_snapshot->>'version' is distinct from '1'
    or jsonb_typeof(p_snapshot->'atlases') is distinct from 'array'
    or octet_length(p_snapshot::text)>9000000 then
    raise sqlstate '22023' using message='invalid_input';
  end if;
  select * into result from public.workspace_snapshots where workspace_id=p_workspace;
  if found and result.request_id=p_request then
    if result.updated_by<>p_actor or result.snapshot<>p_snapshot then raise sqlstate '23505' using message='conflict';end if;
    return result;
  end if;
  if coalesce(result.version,0)<>p_expected then raise sqlstate '23505' using message='conflict';end if;
  insert into public.workspace_snapshots(workspace_id,version,snapshot,request_id,updated_by)
    values(p_workspace,p_expected+1,p_snapshot,p_request,p_actor)
    on conflict(workspace_id) do update set version=excluded.version,snapshot=excluded.snapshot,
      request_id=excluded.request_id,updated_by=excluded.updated_by,updated_at=now()
    returning * into result;
  return result;
end;$$;
revoke all on function public.save_workspace_snapshot(uuid,uuid,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_workspace_snapshot(uuid,uuid,bigint,uuid,jsonb) to service_role;
