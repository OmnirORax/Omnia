-- Run with scripts/check-shared-image-lifecycle.py; all DDL/data roll back.
create function check_image(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception '%',message;end if;end;$$;
create function test_world(images text[]) returns jsonb language sql as $$
 select jsonb_build_object('format','omnium-world','version',3,'nodes',coalesce((select jsonb_agg(jsonb_build_object('scene',image)) from unnest(images) image),'[]'::jsonb));
$$;
insert into omnium_site_draft values(1,1,test_world(array['current']),test_world(array['recovery']),now());
insert into omnium_draft_assets(id,name,type,data,size,uploaded_at) values
 ('current','current','image/png','data',32,'-infinity'),
 ('recovery','recovery','image/png','data',32,'-infinity'),
 ('deleted','deleted','image/png','data',32,'-infinity'),
 ('pending','pending','image/png','data',32,now());
select check_image(omnium_prune_draft_assets()=1,'prune must remove exactly the old unreferenced image');
select check_image((select count(*)=3 from omnium_draft_assets),'current, recovery and pending images must survive');
update omnium_draft_assets set uploaded_at='-infinity' where id='pending';
-- A retry of an existing image renews its lease without changing its content.
select omnium_put_draft_asset('current','ignored','image/png','ignored',1);
select check_image((select data='data' and uploaded_at=now() from omnium_draft_assets where id='current'),'dedup must preserve data and renew the lease');
select omnium_put_draft_asset('next','next','image/png','new',32);
select check_image(omnium_save_draft(1,test_world(array['next']))=2,'snapshot should advance');
select check_image((select previous_world=test_world(array['current']) from omnium_site_draft),'previous draft must be retained');
select check_image(not exists(select 1 from omnium_draft_assets where id='recovery'),'superseded recovery image should be reclaimed');
select check_image(omnium_save_draft(1,test_world(array['missing'])) is null,'stale revision must not write');
select check_image((select revision=2 from omnium_site_draft),'conflict must preserve revision');
do $$begin
 begin perform omnium_save_draft(2,test_world(array['missing']));raise exception 'missing reference accepted';
 exception when raise_exception then if sqlerrm<>'Draft image missing' then raise;end if;end;
end;$$;
-- Current/recovery budgets must not prevent a replacement from uploading.
insert into omnium_draft_assets(id,name,type,data,size,uploaded_at)
 select 'large'||i,'large','image/png','data',10485760,'-infinity'::timestamptz from generate_series(1,20) i;
update omnium_site_draft set world=test_world(array(select 'large'||i from generate_series(1,10) i)),previous_world=test_world(array(select 'large'||i from generate_series(11,20) i));
select omnium_put_draft_asset('replacement','replacement','image/png','data',10485760);
select check_image(exists(select 1 from omnium_draft_assets where id='replacement'),'recovery must not consume the staging budget');
do $$begin
 begin perform omnium_save_draft(2,test_world(array(select 'large'||i from generate_series(1,11) i)));raise exception 'oversized snapshot accepted';
 exception when raise_exception then if sqlerrm<>'Draft images exceed workspace limit' then raise;end if;end;
end;$$;
-- Uncommitted uploads remain bounded even when all are fresh.
insert into omnium_draft_assets(id,name,type,data,size)
 select 'staged'||i,'staged','image/png','data',10485760 from generate_series(1,9) i;
-- Existing small staged records make this already slightly above 100 MiB.
delete from omnium_draft_assets where id in ('current','next');
do $$begin
 begin perform omnium_put_draft_asset('overflow','overflow','image/png','data',1);raise exception 'staging overflow accepted';
 exception when raise_exception then if sqlerrm<>'Draft image library is full' then raise;end if;end;
end;$$;
select check_image(not exists(select 1 from omnium_draft_assets where id='overflow'),'failed upload must roll back its insertion');
update omnium_draft_assets set uploaded_at=now()-interval '31 minutes' where id like 'staged%';
select omnium_put_draft_asset('fresh','fresh','image/png','data',1);
select check_image(not exists(select 1 from omnium_draft_assets where id like 'staged%'),'expired staging must be reclaimed before enforcing quota');
select check_image((select count(*)=20 from omnium_draft_assets where id like 'large%'),'cleanup must preserve every current/recovery image');
select check_image(not has_function_privilege('anon',(select p.oid from pg_proc p where p.pronamespace=current_schema()::regnamespace and proname='omnium_prune_draft_assets'),'EXECUTE'),'anon must not be able to prune');
-- The image-count limit applies even to tiny images.
update omnium_site_draft set world=test_world(array[]::text[]),previous_world=null;
delete from omnium_draft_assets;
insert into omnium_draft_assets(id,name,type,data,size) select 'tiny'||i,'tiny','image/png','data',1 from generate_series(1,100) i;
do $$begin
 begin perform omnium_put_draft_asset('one-too-many','tiny','image/png','data',1);raise exception 'image count limit ignored';
 exception when raise_exception then if sqlerrm<>'Draft image library is full' then raise;end if;end;
end;$$;
-- Exercise the real service role, including DELETE and helper-function grants.
-- Schema/table privileges here are confined to the rollback-only fixture.
do $$begin execute format('grant usage on schema %I to service_role',current_schema());end;$$;
grant select,insert,update on omnium_site_draft,omnium_draft_assets to service_role;
set local role service_role;
select omnium_prune_draft_assets();
reset role;
select 'shared image lifecycle checks passed; transaction rolled back' as result;
