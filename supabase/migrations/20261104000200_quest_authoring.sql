-- Additive authoring: keep all original quest IDs, attempts and one-time claims.
create table public.click_quest_authorship(quest_id text primary key references public.click_quests on delete cascade, user_id uuid references auth.users on delete set null);
alter table public.click_quest_authorship enable row level security;
revoke all on public.click_quest_authorship from public,anon,authenticated;
alter table public.click_quests add column created_at timestamptz not null default clock_timestamp();
alter table public.click_quests add constraint click_quest_requirements unique(benchmark_id,target);
alter table public.click_benchmarks add constraint click_benchmark_seconds unique(seconds);
create index click_quests_creator on public.click_quest_authorship(user_id) where user_id is not null;

create function public.create_click_quest(p_id uuid,p_target integer,p_seconds integer) returns public.click_quests language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); existing public.click_quests; result public.click_quests; benchmark text;
begin
 if actor is null then raise insufficient_privilege; end if;
 if p_id is null or p_target is null or p_seconds is null or p_seconds<1 or p_seconds>3600 or p_target<1 or p_target>p_seconds*100 then raise exception 'Invalid quest requirements' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('click-quest-authoring',572));
 benchmark:='primary-'||p_seconds::text||'s-v1';
 select * into existing from public.click_quests where id=p_id::text;
 if found then
  if not exists(select from public.click_quest_authorship where quest_id=existing.id and user_id=actor) or existing.benchmark_id<>benchmark or existing.target<>p_target then raise exception 'Quest request conflict' using errcode='23505'; end if;
  return existing;
 end if;
 -- Equal goals share a quest identity, and therefore cannot duplicate rewards.
 select q.* into existing from public.click_quests q join public.click_benchmarks b on b.id=q.benchmark_id where q.target=p_target and b.seconds=p_seconds;
 if found then return existing; end if;
 if (select count(*) from public.click_quest_authorship where user_id=actor)>=20 or (select count(*) from public.click_quests)>=500 then raise exception 'Quest creation limit reached' using errcode='22023'; end if;
 select id into benchmark from public.click_benchmarks where seconds=p_seconds;
 if benchmark is null then
  benchmark:='primary-'||p_seconds::text||'s-v1';
  insert into public.click_benchmarks(id,seconds) values(benchmark,p_seconds);
 end if;
 insert into public.click_quests(id,benchmark_id,target) values(p_id::text,benchmark,p_target) returning * into result;
 insert into public.click_quest_authorship(quest_id,user_id) values(result.id,actor);
 return result;
end $$;

-- One bounded board query, rather than one leaderboard query per benchmark.
create function public.click_quest_board() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null then raise insufficient_privilege; end if;
 select jsonb_build_object(
 'benchmarks',coalesce((select jsonb_agg(to_jsonb(b) order by b.seconds) from public.click_benchmarks b),'[]'::jsonb),
 'quests',coalesce((select jsonb_agg(to_jsonb(q) order by q.target,q.created_at,q.id) from public.click_quests q),'[]'::jsonb),
 'claims',coalesce((select jsonb_agg(quest_id) from public.click_claims where user_id=actor),'[]'::jsonb),
 'best',coalesce((select jsonb_object_agg(benchmark_id,clicks) from(select benchmark_id,max(clicks) clicks from public.click_attempts where user_id=actor and finished_at is not null group by benchmark_id)s),'{}'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.create_click_quest(uuid,integer,integer),public.click_quest_board() from public,anon;
grant execute on function public.create_click_quest(uuid,integer,integer),public.click_quest_board() to authenticated;
