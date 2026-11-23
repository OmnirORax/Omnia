-- A bounded, single-submission generation ledger, not a general background queue.
create table public.scene_generations (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id),
  created_by uuid not null references auth.users(id),
  input jsonb not null check (jsonb_typeof(input) = 'object' and octet_length(input::text) <= 16384),
  state text not null default 'running' check (state in ('running', 'ready', 'failed', 'uncertain')),
  asset_id uuid references public.assets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scene_generations_workspace_idx on public.scene_generations(workspace_id, created_at desc);
create index scene_generations_actor_idx on public.scene_generations(created_by, created_at desc);
alter table public.scene_generations enable row level security;
revoke all on public.scene_generations from public, anon, authenticated;
grant select on public.scene_generations to authenticated;
grant all on public.scene_generations to service_role;
create policy scene_generation_read on public.scene_generations for select to authenticated
using ((select private.workspace_role(workspace_id)) is not null);

-- Service-only submission after the handler verifies the actual Auth identity.
-- Serialize quota checks globally; membership is rechecked in this transaction.
create function public.claim_scene_generation(p_id uuid, p_workspace uuid, p_actor uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing public.scene_generations; result public.scene_generations; actor_role text;
begin
  perform pg_advisory_xact_lock(hashtextextended('omnia-scene-generation', 0));
  select role into actor_role from public.workspace_members where workspace_id = p_workspace and user_id = p_actor;
  if coalesce(actor_role, '') not in ('owner', 'editor') then raise sqlstate '42501' using message = 'forbidden'; end if;
  select * into existing from public.scene_generations where id = p_id;
  if found then
    if existing.workspace_id <> p_workspace or existing.created_by <> p_actor or existing.input <> p_input then
      raise sqlstate '23505' using message = 'conflict';
    end if;
    return jsonb_build_object('claimed', false, 'generation', to_jsonb(existing));
  end if;
  if (select count(*) from public.scene_generations where created_by = p_actor and created_at > now() - interval '24 hours') >= 5
    or (select count(*) from public.scene_generations where workspace_id = p_workspace and created_at > now() - interval '24 hours') >= 10
    or (select count(*) from public.scene_generations where created_at > now() - interval '24 hours') >= 25
    or (select count(*) from public.assets where workspace_id = p_workspace) >= 1000
    or (select coalesce(sum(byte_size), 0) from public.assets where workspace_id = p_workspace) > 513802240
    or exists(select 1 from public.scene_generations where workspace_id = p_workspace and state = 'running' and created_at > now() - interval '3 minutes') then
    raise sqlstate 'P0001' using message = 'quota_exceeded';
  end if;
  insert into public.scene_generations(id, workspace_id, created_by, input)
    values (p_id, p_workspace, p_actor, p_input) returning * into result;
  return jsonb_build_object('claimed', true, 'generation', to_jsonb(result));
end; $$;
revoke all on function public.claim_scene_generation(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.claim_scene_generation(uuid, uuid, uuid, jsonb) to service_role;
