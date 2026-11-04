-- Questboard setup for your EXISTING Supabase project. Run in SQL Editor.
-- No token or password is needed in this file. Review before running.
-- Atomic: any error rolls back this entire install, preserving existing data.
-- Re-runs skip only migrations with the exact recorded SQL; changed/untracked
-- installations fail rather than guessing or overwriting prior authored data.
begin;
select pg_advisory_xact_lock(hashtextextended('omnia-schema-deployment',0));
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text);
revoke all on schema supabase_migrations from public,anon,authenticated;
revoke all on table supabase_migrations.schema_migrations from public,anon,authenticated;
do $apply$
begin
 if exists(select from supabase_migrations.schema_migrations where version='20261104000100') then
  if not exists(select from supabase_migrations.schema_migrations where version='20261104000100' and array_to_string(statements,E'\n')='-- Account-scoped rewards and authenticated shared click benchmarks. No workspace
-- membership is implied; no emails or private workspace data enter rankings.
create table public.click_benchmarks(id text primary key, seconds integer not null check(seconds between 1 and 3600));
insert into public.click_benchmarks values (''primary-5s-v1'',5),(''primary-10s-v1'',10),(''primary-30s-v1'',30),(''primary-60s-v1'',60);
create table public.click_quests(id text primary key, benchmark_id text not null references public.click_benchmarks, target integer not null check(target>0));
insert into public.click_quests values (''first-20'',''primary-5s-v1'',20),(''steady-50'',''primary-10s-v1'',50),(''endurance-150'',''primary-30s-v1'',150);
create table public.click_attempts(id uuid primary key, user_id uuid not null references auth.users on delete cascade, benchmark_id text not null references public.click_benchmarks, started_at timestamptz not null default clock_timestamp(), finished_at timestamptz, clicks integer check(clicks>=0));
create index click_attempts_best on public.click_attempts(benchmark_id,user_id,clicks desc) where finished_at is not null;
create index click_attempts_owner_time on public.click_attempts(user_id,started_at desc);
create table public.click_claims(user_id uuid not null references auth.users on delete cascade, quest_id text not null references public.click_quests, attempt_id uuid not null references public.click_attempts, claimed_at timestamptz not null default clock_timestamp(), primary key(user_id,quest_id));
-- A star balance is derived from immutable, unique claims; there is no writable balance.
alter table public.click_benchmarks enable row level security;
alter table public.click_quests enable row level security;
alter table public.click_attempts enable row level security;
alter table public.click_claims enable row level security;
create policy benchmarks_read on public.click_benchmarks for select to authenticated using(true);
create policy quests_read on public.click_quests for select to authenticated using(true);
create policy attempts_read on public.click_attempts for select to authenticated using(user_id=auth.uid());
create policy claims_read on public.click_claims for select to authenticated using(user_id=auth.uid());
revoke all on public.click_benchmarks,public.click_quests,public.click_attempts,public.click_claims from public,anon,authenticated;
grant select on public.click_benchmarks,public.click_quests,public.click_attempts,public.click_claims to authenticated;

create function public.begin_click_attempt(p_benchmark text,p_id uuid) returns public.click_attempts language plpgsql security definer set search_path='''' as $$
declare actor uuid:=auth.uid(); existing public.click_attempts; result public.click_attempts;
begin
 if actor is null then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,572));
 select * into existing from public.click_attempts where id=p_id;
 if found then
  if existing.user_id<>actor or existing.benchmark_id<>p_benchmark then raise exception ''Attempt conflict'' using errcode=''23505''; end if;
  return existing;
 end if;
 if not exists(select from public.click_benchmarks where id=p_benchmark) then raise exception ''Unknown benchmark'' using errcode=''22023''; end if;
 if (select count(*) from public.click_attempts where user_id=actor and started_at>clock_timestamp()-interval ''1 minute'')>=10 or
    (select count(*) from public.click_attempts where user_id=actor and started_at>clock_timestamp()-interval ''1 day'')>=100 then raise exception ''Attempt limit reached'' using errcode=''22023''; end if;
 insert into public.click_attempts(id,user_id,benchmark_id) values(p_id,actor,p_benchmark) returning * into result;
 return result;
end $$;
create function public.finish_click_attempt(p_id uuid,p_clicks integer) returns public.click_attempts language plpgsql security definer set search_path='''' as $$
declare actor uuid:=auth.uid(); attempt public.click_attempts; duration integer;
begin
 if actor is null then raise insufficient_privilege; end if;
 select * into attempt from public.click_attempts where id=p_id and user_id=actor for update;
 if not found then raise insufficient_privilege; end if;
 select seconds into duration from public.click_benchmarks where id=attempt.benchmark_id;
 if p_clicks is null or p_clicks<0 or p_clicks>duration*100 then raise exception ''Invalid click count'' using errcode=''22023''; end if;
 if attempt.finished_at is not null then
  if attempt.clicks<>p_clicks then raise exception ''Attempt already submitted'' using errcode=''23505''; end if;
  return attempt;
 end if;
 if clock_timestamp()<attempt.started_at+duration*interval ''1 second'' or clock_timestamp()>attempt.started_at+(duration+30)*interval ''1 second'' then raise exception ''Attempt timing window expired or incomplete'' using errcode=''22023''; end if;
 update public.click_attempts set clicks=p_clicks,finished_at=clock_timestamp() where id=p_id returning * into attempt;
 return attempt;
end $$;
create function public.claim_click_quest(p_quest text) returns integer language plpgsql security definer set search_path='''' as $$
declare actor uuid:=auth.uid(); proof uuid;
begin
 if actor is null then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,572));
 select a.id into proof from public.click_attempts a join public.click_quests q on q.benchmark_id=a.benchmark_id where q.id=p_quest and a.user_id=actor and a.finished_at is not null and a.clicks>=q.target order by a.clicks desc,a.finished_at,a.id limit 1;
 if proof is null then raise exception ''Quest not complete'' using errcode=''22023''; end if;
 insert into public.click_claims(user_id,quest_id,attempt_id) values(actor,p_quest,proof) on conflict(user_id,quest_id) do nothing;
 return (select count(*)::integer from public.click_claims where user_id=actor);
end $$;
create function public.click_standings(p_benchmark text) returns jsonb language plpgsql stable security definer set search_path='''' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 if not exists(select from public.click_benchmarks where id=p_benchmark) then raise exception ''Unknown benchmark'' using errcode=''22023''; end if;
 with best as (select distinct on(user_id) user_id,clicks,finished_at from public.click_attempts where benchmark_id=p_benchmark and finished_at is not null order by user_id,clicks desc,finished_at,id),
 ranked as (select dense_rank() over(order by clicks desc) as rank,''Player-''||left(md5(user_id::text),10) as player,clicks,finished_at,user_id=auth.uid() as is_you from best)
 select jsonb_build_object(''top'',coalesce((select jsonb_agg(to_jsonb(t)) from(select * from ranked order by rank,finished_at,player limit 50)t),''[]''::jsonb),''mine'',(select to_jsonb(r) from ranked r where is_you)) into result;
 return result;
end $$;
revoke all on function public.begin_click_attempt(text,uuid),public.finish_click_attempt(uuid,integer),public.claim_click_quest(text),public.click_standings(text) from public,anon;
grant execute on function public.begin_click_attempt(text,uuid),public.finish_click_attempt(uuid,integer),public.claim_click_quest(text),public.click_standings(text) to authenticated;
') then raise exception 'Migration history differs: 20261104000100. Stop and review; no data was changed.'; end if;
 else
  if to_regclass('public.click_quests') is not null then raise exception 'Click quests exist without recorded migration history. Stop and review; no data was changed.'; end if;
  execute '-- Account-scoped rewards and authenticated shared click benchmarks. No workspace
-- membership is implied; no emails or private workspace data enter rankings.
create table public.click_benchmarks(id text primary key, seconds integer not null check(seconds between 1 and 3600));
insert into public.click_benchmarks values (''primary-5s-v1'',5),(''primary-10s-v1'',10),(''primary-30s-v1'',30),(''primary-60s-v1'',60);
create table public.click_quests(id text primary key, benchmark_id text not null references public.click_benchmarks, target integer not null check(target>0));
insert into public.click_quests values (''first-20'',''primary-5s-v1'',20),(''steady-50'',''primary-10s-v1'',50),(''endurance-150'',''primary-30s-v1'',150);
create table public.click_attempts(id uuid primary key, user_id uuid not null references auth.users on delete cascade, benchmark_id text not null references public.click_benchmarks, started_at timestamptz not null default clock_timestamp(), finished_at timestamptz, clicks integer check(clicks>=0));
create index click_attempts_best on public.click_attempts(benchmark_id,user_id,clicks desc) where finished_at is not null;
create index click_attempts_owner_time on public.click_attempts(user_id,started_at desc);
create table public.click_claims(user_id uuid not null references auth.users on delete cascade, quest_id text not null references public.click_quests, attempt_id uuid not null references public.click_attempts, claimed_at timestamptz not null default clock_timestamp(), primary key(user_id,quest_id));
-- A star balance is derived from immutable, unique claims; there is no writable balance.
alter table public.click_benchmarks enable row level security;
alter table public.click_quests enable row level security;
alter table public.click_attempts enable row level security;
alter table public.click_claims enable row level security;
create policy benchmarks_read on public.click_benchmarks for select to authenticated using(true);
create policy quests_read on public.click_quests for select to authenticated using(true);
create policy attempts_read on public.click_attempts for select to authenticated using(user_id=auth.uid());
create policy claims_read on public.click_claims for select to authenticated using(user_id=auth.uid());
revoke all on public.click_benchmarks,public.click_quests,public.click_attempts,public.click_claims from public,anon,authenticated;
grant select on public.click_benchmarks,public.click_quests,public.click_attempts,public.click_claims to authenticated;

create function public.begin_click_attempt(p_benchmark text,p_id uuid) returns public.click_attempts language plpgsql security definer set search_path='''' as $$
declare actor uuid:=auth.uid(); existing public.click_attempts; result public.click_attempts;
begin
 if actor is null then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,572));
 select * into existing from public.click_attempts where id=p_id;
 if found then
  if existing.user_id<>actor or existing.benchmark_id<>p_benchmark then raise exception ''Attempt conflict'' using errcode=''23505''; end if;
  return existing;
 end if;
 if not exists(select from public.click_benchmarks where id=p_benchmark) then raise exception ''Unknown benchmark'' using errcode=''22023''; end if;
 if (select count(*) from public.click_attempts where user_id=actor and started_at>clock_timestamp()-interval ''1 minute'')>=10 or
    (select count(*) from public.click_attempts where user_id=actor and started_at>clock_timestamp()-interval ''1 day'')>=100 then raise exception ''Attempt limit reached'' using errcode=''22023''; end if;
 insert into public.click_attempts(id,user_id,benchmark_id) values(p_id,actor,p_benchmark) returning * into result;
 return result;
end $$;
create function public.finish_click_attempt(p_id uuid,p_clicks integer) returns public.click_attempts language plpgsql security definer set search_path='''' as $$
declare actor uuid:=auth.uid(); attempt public.click_attempts; duration integer;
begin
 if actor is null then raise insufficient_privilege; end if;
 select * into attempt from public.click_attempts where id=p_id and user_id=actor for update;
 if not found then raise insufficient_privilege; end if;
 select seconds into duration from public.click_benchmarks where id=attempt.benchmark_id;
 if p_clicks is null or p_clicks<0 or p_clicks>duration*100 then raise exception ''Invalid click count'' using errcode=''22023''; end if;
 if attempt.finished_at is not null then
  if attempt.clicks<>p_clicks then raise exception ''Attempt already submitted'' using errcode=''23505''; end if;
  return attempt;
 end if;
 if clock_timestamp()<attempt.started_at+duration*interval ''1 second'' or clock_timestamp()>attempt.started_at+(duration+30)*interval ''1 second'' then raise exception ''Attempt timing window expired or incomplete'' using errcode=''22023''; end if;
 update public.click_attempts set clicks=p_clicks,finished_at=clock_timestamp() where id=p_id returning * into attempt;
 return attempt;
end $$;
create function public.claim_click_quest(p_quest text) returns integer language plpgsql security definer set search_path='''' as $$
declare actor uuid:=auth.uid(); proof uuid;
begin
 if actor is null then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,572));
 select a.id into proof from public.click_attempts a join public.click_quests q on q.benchmark_id=a.benchmark_id where q.id=p_quest and a.user_id=actor and a.finished_at is not null and a.clicks>=q.target order by a.clicks desc,a.finished_at,a.id limit 1;
 if proof is null then raise exception ''Quest not complete'' using errcode=''22023''; end if;
 insert into public.click_claims(user_id,quest_id,attempt_id) values(actor,p_quest,proof) on conflict(user_id,quest_id) do nothing;
 return (select count(*)::integer from public.click_claims where user_id=actor);
end $$;
create function public.click_standings(p_benchmark text) returns jsonb language plpgsql stable security definer set search_path='''' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 if not exists(select from public.click_benchmarks where id=p_benchmark) then raise exception ''Unknown benchmark'' using errcode=''22023''; end if;
 with best as (select distinct on(user_id) user_id,clicks,finished_at from public.click_attempts where benchmark_id=p_benchmark and finished_at is not null order by user_id,clicks desc,finished_at,id),
 ranked as (select dense_rank() over(order by clicks desc) as rank,''Player-''||left(md5(user_id::text),10) as player,clicks,finished_at,user_id=auth.uid() as is_you from best)
 select jsonb_build_object(''top'',coalesce((select jsonb_agg(to_jsonb(t)) from(select * from ranked order by rank,finished_at,player limit 50)t),''[]''::jsonb),''mine'',(select to_jsonb(r) from ranked r where is_you)) into result;
 return result;
end $$;
revoke all on function public.begin_click_attempt(text,uuid),public.finish_click_attempt(uuid,integer),public.claim_click_quest(text),public.click_standings(text) from public,anon;
grant execute on function public.begin_click_attempt(text,uuid),public.finish_click_attempt(uuid,integer),public.claim_click_quest(text),public.click_standings(text) to authenticated;
';
  insert into supabase_migrations.schema_migrations(version,statements,name) values('20261104000100',array['-- Account-scoped rewards and authenticated shared click benchmarks. No workspace
-- membership is implied; no emails or private workspace data enter rankings.
create table public.click_benchmarks(id text primary key, seconds integer not null check(seconds between 1 and 3600));
insert into public.click_benchmarks values (''primary-5s-v1'',5),(''primary-10s-v1'',10),(''primary-30s-v1'',30),(''primary-60s-v1'',60);
create table public.click_quests(id text primary key, benchmark_id text not null references public.click_benchmarks, target integer not null check(target>0));
insert into public.click_quests values (''first-20'',''primary-5s-v1'',20),(''steady-50'',''primary-10s-v1'',50),(''endurance-150'',''primary-30s-v1'',150);
create table public.click_attempts(id uuid primary key, user_id uuid not null references auth.users on delete cascade, benchmark_id text not null references public.click_benchmarks, started_at timestamptz not null default clock_timestamp(), finished_at timestamptz, clicks integer check(clicks>=0));
create index click_attempts_best on public.click_attempts(benchmark_id,user_id,clicks desc) where finished_at is not null;
create index click_attempts_owner_time on public.click_attempts(user_id,started_at desc);
create table public.click_claims(user_id uuid not null references auth.users on delete cascade, quest_id text not null references public.click_quests, attempt_id uuid not null references public.click_attempts, claimed_at timestamptz not null default clock_timestamp(), primary key(user_id,quest_id));
-- A star balance is derived from immutable, unique claims; there is no writable balance.
alter table public.click_benchmarks enable row level security;
alter table public.click_quests enable row level security;
alter table public.click_attempts enable row level security;
alter table public.click_claims enable row level security;
create policy benchmarks_read on public.click_benchmarks for select to authenticated using(true);
create policy quests_read on public.click_quests for select to authenticated using(true);
create policy attempts_read on public.click_attempts for select to authenticated using(user_id=auth.uid());
create policy claims_read on public.click_claims for select to authenticated using(user_id=auth.uid());
revoke all on public.click_benchmarks,public.click_quests,public.click_attempts,public.click_claims from public,anon,authenticated;
grant select on public.click_benchmarks,public.click_quests,public.click_attempts,public.click_claims to authenticated;

create function public.begin_click_attempt(p_benchmark text,p_id uuid) returns public.click_attempts language plpgsql security definer set search_path='''' as $$
declare actor uuid:=auth.uid(); existing public.click_attempts; result public.click_attempts;
begin
 if actor is null then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,572));
 select * into existing from public.click_attempts where id=p_id;
 if found then
  if existing.user_id<>actor or existing.benchmark_id<>p_benchmark then raise exception ''Attempt conflict'' using errcode=''23505''; end if;
  return existing;
 end if;
 if not exists(select from public.click_benchmarks where id=p_benchmark) then raise exception ''Unknown benchmark'' using errcode=''22023''; end if;
 if (select count(*) from public.click_attempts where user_id=actor and started_at>clock_timestamp()-interval ''1 minute'')>=10 or
    (select count(*) from public.click_attempts where user_id=actor and started_at>clock_timestamp()-interval ''1 day'')>=100 then raise exception ''Attempt limit reached'' using errcode=''22023''; end if;
 insert into public.click_attempts(id,user_id,benchmark_id) values(p_id,actor,p_benchmark) returning * into result;
 return result;
end $$;
create function public.finish_click_attempt(p_id uuid,p_clicks integer) returns public.click_attempts language plpgsql security definer set search_path='''' as $$
declare actor uuid:=auth.uid(); attempt public.click_attempts; duration integer;
begin
 if actor is null then raise insufficient_privilege; end if;
 select * into attempt from public.click_attempts where id=p_id and user_id=actor for update;
 if not found then raise insufficient_privilege; end if;
 select seconds into duration from public.click_benchmarks where id=attempt.benchmark_id;
 if p_clicks is null or p_clicks<0 or p_clicks>duration*100 then raise exception ''Invalid click count'' using errcode=''22023''; end if;
 if attempt.finished_at is not null then
  if attempt.clicks<>p_clicks then raise exception ''Attempt already submitted'' using errcode=''23505''; end if;
  return attempt;
 end if;
 if clock_timestamp()<attempt.started_at+duration*interval ''1 second'' or clock_timestamp()>attempt.started_at+(duration+30)*interval ''1 second'' then raise exception ''Attempt timing window expired or incomplete'' using errcode=''22023''; end if;
 update public.click_attempts set clicks=p_clicks,finished_at=clock_timestamp() where id=p_id returning * into attempt;
 return attempt;
end $$;
create function public.claim_click_quest(p_quest text) returns integer language plpgsql security definer set search_path='''' as $$
declare actor uuid:=auth.uid(); proof uuid;
begin
 if actor is null then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,572));
 select a.id into proof from public.click_attempts a join public.click_quests q on q.benchmark_id=a.benchmark_id where q.id=p_quest and a.user_id=actor and a.finished_at is not null and a.clicks>=q.target order by a.clicks desc,a.finished_at,a.id limit 1;
 if proof is null then raise exception ''Quest not complete'' using errcode=''22023''; end if;
 insert into public.click_claims(user_id,quest_id,attempt_id) values(actor,p_quest,proof) on conflict(user_id,quest_id) do nothing;
 return (select count(*)::integer from public.click_claims where user_id=actor);
end $$;
create function public.click_standings(p_benchmark text) returns jsonb language plpgsql stable security definer set search_path='''' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 if not exists(select from public.click_benchmarks where id=p_benchmark) then raise exception ''Unknown benchmark'' using errcode=''22023''; end if;
 with best as (select distinct on(user_id) user_id,clicks,finished_at from public.click_attempts where benchmark_id=p_benchmark and finished_at is not null order by user_id,clicks desc,finished_at,id),
 ranked as (select dense_rank() over(order by clicks desc) as rank,''Player-''||left(md5(user_id::text),10) as player,clicks,finished_at,user_id=auth.uid() as is_you from best)
 select jsonb_build_object(''top'',coalesce((select jsonb_agg(to_jsonb(t)) from(select * from ranked order by rank,finished_at,player limit 50)t),''[]''::jsonb),''mine'',(select to_jsonb(r) from ranked r where is_you)) into result;
 return result;
end $$;
revoke all on function public.begin_click_attempt(text,uuid),public.finish_click_attempt(uuid,integer),public.claim_click_quest(text),public.click_standings(text) from public,anon;
grant execute on function public.begin_click_attempt(text,uuid),public.finish_click_attempt(uuid,integer),public.claim_click_quest(text),public.click_standings(text) to authenticated;
'],'click_quests');
 end if;
end $apply$;
do $apply$
begin
 if exists(select from supabase_migrations.schema_migrations where version='20261104000200') then
  if not exists(select from supabase_migrations.schema_migrations where version='20261104000200' and array_to_string(statements,E'\n')='-- Additive authoring: keep all original quest IDs, attempts and one-time claims.
create table public.click_quest_authorship(quest_id text primary key references public.click_quests on delete cascade, user_id uuid references auth.users on delete set null);
alter table public.click_quest_authorship enable row level security;
revoke all on public.click_quest_authorship from public,anon,authenticated;
alter table public.click_quests add column created_at timestamptz not null default clock_timestamp();
alter table public.click_quests add constraint click_quest_requirements unique(benchmark_id,target);
alter table public.click_benchmarks add constraint click_benchmark_seconds unique(seconds);
create index click_quests_creator on public.click_quest_authorship(user_id) where user_id is not null;

create function public.create_click_quest(p_id uuid,p_target integer,p_seconds integer) returns public.click_quests language plpgsql security definer set search_path='''' as $$
declare actor uuid:=auth.uid(); existing public.click_quests; result public.click_quests; benchmark text;
begin
 if actor is null then raise insufficient_privilege; end if;
 if p_id is null or p_target is null or p_seconds is null or p_seconds<1 or p_seconds>3600 or p_target<1 or p_target>p_seconds*100 then raise exception ''Invalid quest requirements'' using errcode=''22023''; end if;
 perform pg_advisory_xact_lock(hashtextextended(''click-quest-authoring'',572));
 benchmark:=''primary-''||p_seconds::text||''s-v1'';
 select * into existing from public.click_quests where id=p_id::text;
 if found then
  if not exists(select from public.click_quest_authorship where quest_id=existing.id and user_id=actor) or existing.benchmark_id<>benchmark or existing.target<>p_target then raise exception ''Quest request conflict'' using errcode=''23505''; end if;
  return existing;
 end if;
 -- Equal goals share a quest identity, and therefore cannot duplicate rewards.
 select q.* into existing from public.click_quests q join public.click_benchmarks b on b.id=q.benchmark_id where q.target=p_target and b.seconds=p_seconds;
 if found then return existing; end if;
 if (select count(*) from public.click_quest_authorship where user_id=actor)>=20 or (select count(*) from public.click_quests)>=500 then raise exception ''Quest creation limit reached'' using errcode=''22023''; end if;
 select id into benchmark from public.click_benchmarks where seconds=p_seconds;
 if benchmark is null then
  benchmark:=''primary-''||p_seconds::text||''s-v1'';
  insert into public.click_benchmarks(id,seconds) values(benchmark,p_seconds);
 end if;
 insert into public.click_quests(id,benchmark_id,target) values(p_id::text,benchmark,p_target) returning * into result;
 insert into public.click_quest_authorship(quest_id,user_id) values(result.id,actor);
 return result;
end $$;

-- One bounded board query, rather than one leaderboard query per benchmark.
create function public.click_quest_board() returns jsonb language plpgsql stable security definer set search_path='''' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null then raise insufficient_privilege; end if;
 select jsonb_build_object(
 ''benchmarks'',coalesce((select jsonb_agg(to_jsonb(b) order by b.seconds) from public.click_benchmarks b),''[]''::jsonb),
 ''quests'',coalesce((select jsonb_agg(to_jsonb(q) order by q.target,q.created_at,q.id) from public.click_quests q),''[]''::jsonb),
 ''claims'',coalesce((select jsonb_agg(quest_id) from public.click_claims where user_id=actor),''[]''::jsonb),
 ''best'',coalesce((select jsonb_object_agg(benchmark_id,clicks) from(select benchmark_id,max(clicks) clicks from public.click_attempts where user_id=actor and finished_at is not null group by benchmark_id)s),''{}''::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.create_click_quest(uuid,integer,integer),public.click_quest_board() from public,anon;
grant execute on function public.create_click_quest(uuid,integer,integer),public.click_quest_board() to authenticated;
') then raise exception 'Migration history differs: 20261104000200. Stop and review; no data was changed.'; end if;
 else
  
  execute '-- Additive authoring: keep all original quest IDs, attempts and one-time claims.
create table public.click_quest_authorship(quest_id text primary key references public.click_quests on delete cascade, user_id uuid references auth.users on delete set null);
alter table public.click_quest_authorship enable row level security;
revoke all on public.click_quest_authorship from public,anon,authenticated;
alter table public.click_quests add column created_at timestamptz not null default clock_timestamp();
alter table public.click_quests add constraint click_quest_requirements unique(benchmark_id,target);
alter table public.click_benchmarks add constraint click_benchmark_seconds unique(seconds);
create index click_quests_creator on public.click_quest_authorship(user_id) where user_id is not null;

create function public.create_click_quest(p_id uuid,p_target integer,p_seconds integer) returns public.click_quests language plpgsql security definer set search_path='''' as $$
declare actor uuid:=auth.uid(); existing public.click_quests; result public.click_quests; benchmark text;
begin
 if actor is null then raise insufficient_privilege; end if;
 if p_id is null or p_target is null or p_seconds is null or p_seconds<1 or p_seconds>3600 or p_target<1 or p_target>p_seconds*100 then raise exception ''Invalid quest requirements'' using errcode=''22023''; end if;
 perform pg_advisory_xact_lock(hashtextextended(''click-quest-authoring'',572));
 benchmark:=''primary-''||p_seconds::text||''s-v1'';
 select * into existing from public.click_quests where id=p_id::text;
 if found then
  if not exists(select from public.click_quest_authorship where quest_id=existing.id and user_id=actor) or existing.benchmark_id<>benchmark or existing.target<>p_target then raise exception ''Quest request conflict'' using errcode=''23505''; end if;
  return existing;
 end if;
 -- Equal goals share a quest identity, and therefore cannot duplicate rewards.
 select q.* into existing from public.click_quests q join public.click_benchmarks b on b.id=q.benchmark_id where q.target=p_target and b.seconds=p_seconds;
 if found then return existing; end if;
 if (select count(*) from public.click_quest_authorship where user_id=actor)>=20 or (select count(*) from public.click_quests)>=500 then raise exception ''Quest creation limit reached'' using errcode=''22023''; end if;
 select id into benchmark from public.click_benchmarks where seconds=p_seconds;
 if benchmark is null then
  benchmark:=''primary-''||p_seconds::text||''s-v1'';
  insert into public.click_benchmarks(id,seconds) values(benchmark,p_seconds);
 end if;
 insert into public.click_quests(id,benchmark_id,target) values(p_id::text,benchmark,p_target) returning * into result;
 insert into public.click_quest_authorship(quest_id,user_id) values(result.id,actor);
 return result;
end $$;

-- One bounded board query, rather than one leaderboard query per benchmark.
create function public.click_quest_board() returns jsonb language plpgsql stable security definer set search_path='''' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null then raise insufficient_privilege; end if;
 select jsonb_build_object(
 ''benchmarks'',coalesce((select jsonb_agg(to_jsonb(b) order by b.seconds) from public.click_benchmarks b),''[]''::jsonb),
 ''quests'',coalesce((select jsonb_agg(to_jsonb(q) order by q.target,q.created_at,q.id) from public.click_quests q),''[]''::jsonb),
 ''claims'',coalesce((select jsonb_agg(quest_id) from public.click_claims where user_id=actor),''[]''::jsonb),
 ''best'',coalesce((select jsonb_object_agg(benchmark_id,clicks) from(select benchmark_id,max(clicks) clicks from public.click_attempts where user_id=actor and finished_at is not null group by benchmark_id)s),''{}''::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.create_click_quest(uuid,integer,integer),public.click_quest_board() from public,anon;
grant execute on function public.create_click_quest(uuid,integer,integer),public.click_quest_board() to authenticated;
';
  insert into supabase_migrations.schema_migrations(version,statements,name) values('20261104000200',array['-- Additive authoring: keep all original quest IDs, attempts and one-time claims.
create table public.click_quest_authorship(quest_id text primary key references public.click_quests on delete cascade, user_id uuid references auth.users on delete set null);
alter table public.click_quest_authorship enable row level security;
revoke all on public.click_quest_authorship from public,anon,authenticated;
alter table public.click_quests add column created_at timestamptz not null default clock_timestamp();
alter table public.click_quests add constraint click_quest_requirements unique(benchmark_id,target);
alter table public.click_benchmarks add constraint click_benchmark_seconds unique(seconds);
create index click_quests_creator on public.click_quest_authorship(user_id) where user_id is not null;

create function public.create_click_quest(p_id uuid,p_target integer,p_seconds integer) returns public.click_quests language plpgsql security definer set search_path='''' as $$
declare actor uuid:=auth.uid(); existing public.click_quests; result public.click_quests; benchmark text;
begin
 if actor is null then raise insufficient_privilege; end if;
 if p_id is null or p_target is null or p_seconds is null or p_seconds<1 or p_seconds>3600 or p_target<1 or p_target>p_seconds*100 then raise exception ''Invalid quest requirements'' using errcode=''22023''; end if;
 perform pg_advisory_xact_lock(hashtextextended(''click-quest-authoring'',572));
 benchmark:=''primary-''||p_seconds::text||''s-v1'';
 select * into existing from public.click_quests where id=p_id::text;
 if found then
  if not exists(select from public.click_quest_authorship where quest_id=existing.id and user_id=actor) or existing.benchmark_id<>benchmark or existing.target<>p_target then raise exception ''Quest request conflict'' using errcode=''23505''; end if;
  return existing;
 end if;
 -- Equal goals share a quest identity, and therefore cannot duplicate rewards.
 select q.* into existing from public.click_quests q join public.click_benchmarks b on b.id=q.benchmark_id where q.target=p_target and b.seconds=p_seconds;
 if found then return existing; end if;
 if (select count(*) from public.click_quest_authorship where user_id=actor)>=20 or (select count(*) from public.click_quests)>=500 then raise exception ''Quest creation limit reached'' using errcode=''22023''; end if;
 select id into benchmark from public.click_benchmarks where seconds=p_seconds;
 if benchmark is null then
  benchmark:=''primary-''||p_seconds::text||''s-v1'';
  insert into public.click_benchmarks(id,seconds) values(benchmark,p_seconds);
 end if;
 insert into public.click_quests(id,benchmark_id,target) values(p_id::text,benchmark,p_target) returning * into result;
 insert into public.click_quest_authorship(quest_id,user_id) values(result.id,actor);
 return result;
end $$;

-- One bounded board query, rather than one leaderboard query per benchmark.
create function public.click_quest_board() returns jsonb language plpgsql stable security definer set search_path='''' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null then raise insufficient_privilege; end if;
 select jsonb_build_object(
 ''benchmarks'',coalesce((select jsonb_agg(to_jsonb(b) order by b.seconds) from public.click_benchmarks b),''[]''::jsonb),
 ''quests'',coalesce((select jsonb_agg(to_jsonb(q) order by q.target,q.created_at,q.id) from public.click_quests q),''[]''::jsonb),
 ''claims'',coalesce((select jsonb_agg(quest_id) from public.click_claims where user_id=actor),''[]''::jsonb),
 ''best'',coalesce((select jsonb_object_agg(benchmark_id,clicks) from(select benchmark_id,max(clicks) clicks from public.click_attempts where user_id=actor and finished_at is not null group by benchmark_id)s),''{}''::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.create_click_quest(uuid,integer,integer),public.click_quest_board() from public,anon;
grant execute on function public.create_click_quest(uuid,integer,integer),public.click_quest_board() to authenticated;
'],'quest_authoring');
 end if;
end $apply$;
notify pgrst, 'reload schema';
commit;
select 'Questboard migrations installed. Use the configured cloud app and sign in.' as status;
