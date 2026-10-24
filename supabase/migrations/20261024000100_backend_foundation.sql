-- Workspace identity is separate from atlas identity and canonical knowledge.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  created_by uuid not null references auth.users(id),
  creation_request_id uuid not null,
  created_at timestamptz not null default now(),
  unique (created_by, creation_request_id)
);
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members(user_id, workspace_id);
create unique index workspace_single_owner_idx on public.workspace_members(workspace_id) where role = 'owner';

create table public.assets (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id),
  created_by uuid not null references auth.users(id),
  name text not null check (length(btrim(name)) between 1 and 200),
  media_type text not null check (media_type in ('image/png', 'image/jpeg', 'image/webp')),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  object_key text generated always as (workspace_id::text || '/' || id::text) stored unique,
  state text not null default 'pending' check (state in ('pending', 'ready', 'deleting')),
  created_at timestamptz not null default now()
);
create index assets_workspace_idx on public.assets(workspace_id, created_at);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.assets enable row level security;
revoke all on public.workspaces, public.workspace_members, public.assets from anon, authenticated;
grant select on public.workspaces, public.workspace_members, public.assets to authenticated;
grant all on public.workspaces, public.workspace_members, public.assets to service_role;

-- A fixed-search-path definer avoids membership-policy recursion. It checks only
-- the actual caller, not an arbitrary user supplied by a client.
create function private.workspace_role(p_workspace uuid) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.workspace_members
  where workspace_id = p_workspace and user_id = (select auth.uid());
$$;
revoke all on function private.workspace_role(uuid) from public, anon;
grant execute on function private.workspace_role(uuid) to authenticated;

create policy workspace_read on public.workspaces for select to authenticated
using ((select private.workspace_role(id)) is not null);
create policy membership_read on public.workspace_members for select to authenticated
using ((select private.workspace_role(workspace_id)) is not null);
create policy asset_read on public.assets for select to authenticated
using ((select private.workspace_role(workspace_id)) is not null
  and (state = 'ready' or created_by = (select auth.uid()) or (select private.workspace_role(workspace_id)) in ('owner', 'editor')));

create function public.create_workspace(p_name text, p_request_id uuid)
returns public.workspaces language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result public.workspaces;
begin
  if actor is null then raise sqlstate '42501' using message = 'unauthenticated'; end if;
  if p_request_id is null or p_name is null or length(btrim(p_name)) not between 1 and 100 then
    raise sqlstate '22023' using message = 'invalid_input';
  end if;
  -- Serializes both quota checks and duplicate submissions for this actor.
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 0));
  select * into result from public.workspaces where created_by = actor and creation_request_id = p_request_id;
  if found then
    if result.name <> btrim(p_name) then raise sqlstate '23505' using message = 'conflict'; end if;
    return result;
  end if;
  if (select count(*) from public.workspaces where created_by = actor) >= 25 then
    raise sqlstate 'P0001' using message = 'quota_exceeded';
  end if;
  insert into public.workspaces(name, created_by, creation_request_id)
    values (btrim(p_name), actor, p_request_id) returning * into result;
  insert into public.workspace_members(workspace_id, user_id, role) values (result.id, actor, 'owner');
  return result;
end; $$;

-- Account invitations are operational for now. Only an owner may grant an
-- existing account editor/viewer access. Ownership transfer is intentionally absent.
create function public.set_workspace_member(p_workspace_id uuid, p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.workspaces where id = p_workspace_id for update;
  if private.workspace_role(p_workspace_id) is distinct from 'owner' then
    raise sqlstate '42501' using message = 'forbidden';
  end if;
  if p_user_id is null or p_user_id = auth.uid() or p_role is not null and p_role not in ('editor', 'viewer') then
    raise sqlstate '22023' using message = 'invalid_input';
  end if;
  if p_role is null then
    delete from public.workspace_members where workspace_id = p_workspace_id and user_id = p_user_id and role <> 'owner';
  else
    insert into public.workspace_members(workspace_id, user_id, role)
      values (p_workspace_id, p_user_id, p_role)
      on conflict (workspace_id, user_id) do update set role = excluded.role;
  end if;
end; $$;

create function public.reserve_asset(p_id uuid, p_workspace_id uuid, p_name text, p_media_type text, p_byte_size bigint)
returns public.assets language plpgsql security definer set search_path = '' as $$
declare result public.assets;
begin
  perform 1 from public.workspaces where id = p_workspace_id for update;
  if coalesce(private.workspace_role(p_workspace_id), '') not in ('owner', 'editor') then
    raise sqlstate '42501' using message = 'forbidden';
  end if;
  if p_id is null or p_name is null or length(btrim(p_name)) not between 1 and 200
    or p_media_type is null or p_media_type not in ('image/png', 'image/jpeg', 'image/webp')
    or p_byte_size is null or p_byte_size not between 1 and 10485760 then
    raise sqlstate '22023' using message = 'invalid_input';
  end if;
  select * into result from public.assets where id = p_id;
  if found then
    if result.workspace_id <> p_workspace_id or result.created_by <> auth.uid()
      or result.name <> btrim(p_name) or result.media_type <> p_media_type or result.byte_size <> p_byte_size then
      raise sqlstate '23505' using message = 'conflict';
    end if;
    return result;
  end if;
  if (select count(*) from public.assets where workspace_id = p_workspace_id) >= 1000
    or (select coalesce(sum(byte_size),0) from public.assets where workspace_id = p_workspace_id) + p_byte_size > 524288000 then
    raise sqlstate 'P0001' using message = 'quota_exceeded';
  end if;
  insert into public.assets(id, workspace_id, created_by, name, media_type, byte_size)
    values (p_id, p_workspace_id, auth.uid(), btrim(p_name), p_media_type, p_byte_size) returning * into result;
  return result;
end; $$;

create function public.begin_asset_delete(p_id uuid) returns public.assets
language plpgsql security definer set search_path = '' as $$
declare result public.assets;
begin
  select * into result from public.assets where id = p_id for update;
  if not found or coalesce(private.workspace_role(result.workspace_id), '') not in ('owner', 'editor') then
    raise sqlstate '42501' using message = 'forbidden';
  end if;
  update public.assets set state = 'deleting' where id = p_id returning * into result;
  return result;
end; $$;

-- Only the trusted handler may finalize after verifying the uploaded bytes.
create function public.complete_asset(p_id uuid, p_actor uuid, p_byte_size bigint, p_media_type text)
returns public.assets language plpgsql security definer set search_path = '' as $$
declare result public.assets;
begin
  select * into result from public.assets where id = p_id for update;
  if not found then raise sqlstate 'P0002' using message = 'not_found'; end if;
  if result.created_by <> p_actor or not exists (
    select 1 from public.workspace_members where workspace_id = result.workspace_id and user_id = p_actor and role in ('owner','editor')
  ) then raise sqlstate '42501' using message = 'forbidden'; end if;
  if result.state = 'deleting' or result.byte_size <> p_byte_size or result.media_type <> p_media_type
    or not exists (select 1 from storage.objects where bucket_id = 'workspace-assets' and name = result.object_key) then
    raise sqlstate '23505' using message = 'conflict';
  end if;
  update public.assets set state = 'ready' where id = p_id returning * into result;
  return result;
end; $$;

create function public.complete_asset_delete(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from storage.objects o join public.assets a on a.object_key = o.name
    where a.id = p_id and o.bucket_id = 'workspace-assets') then
    raise sqlstate '23505' using message = 'conflict';
  end if;
  delete from public.assets where id = p_id and state = 'deleting';
end; $$;

-- No default PUBLIC function execution, and no direct writes to authority-bearing rows.
revoke all on function public.create_workspace(text, uuid), public.set_workspace_member(uuid, uuid, text),
  public.reserve_asset(uuid, uuid, text, text, bigint), public.begin_asset_delete(uuid),
  public.complete_asset(uuid, uuid, bigint, text), public.complete_asset_delete(uuid) from public, anon, authenticated;
grant execute on function public.create_workspace(text, uuid), public.set_workspace_member(uuid, uuid, text),
  public.reserve_asset(uuid, uuid, text, text, bigint), public.begin_asset_delete(uuid) to authenticated;
grant execute on function public.complete_asset(uuid, uuid, bigint, text), public.complete_asset_delete(uuid) to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('workspace-assets', 'workspace-assets', false, 10485760, array['image/png','image/jpeg','image/webp']);

create function private.can_upload_asset(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.assets a
    where a.object_key = p_key and a.state = 'pending' and a.created_by = (select auth.uid())
    and private.workspace_role(a.workspace_id) in ('owner','editor'));
$$;
create function private.can_read_asset(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.assets a
    where a.object_key = p_key and private.workspace_role(a.workspace_id) is not null
    and (a.state = 'ready' or a.state = 'pending' and a.created_by = (select auth.uid())));
$$;
revoke all on function private.can_upload_asset(text), private.can_read_asset(text) from public, anon;
grant execute on function private.can_upload_asset(text), private.can_read_asset(text) to authenticated;
create policy asset_object_insert on storage.objects for insert to authenticated
with check (bucket_id = 'workspace-assets' and (select private.can_upload_asset(name)));
create policy asset_object_read on storage.objects for select to authenticated
using (bucket_id = 'workspace-assets' and (select private.can_read_asset(name)));
-- No authenticated UPDATE/DELETE policy: objects are immutable and deletion is coordinated.
