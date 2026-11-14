-- A successful Push removes explicitly deleted, unreferenced uploads immediately.
update omnium_site_draft set world=test_world(array[]::text[]),previous_world=null;
delete from omnium_draft_assets;
select omnium_put_draft_asset('sha256:'||repeat('a',64),'deleted','image/png','data',1);
select omnium_save_draft(2,test_world(array[]::text[]),array['sha256:'||repeat('a',64)]);
select check_image(not exists(select 1 from omnium_draft_assets),'explicit deletion must bypass the upload grace period');
-- A conflict must not acknowledge, mark or delete anything.
select omnium_put_draft_asset('sha256:'||repeat('b',64),'current','image/png','data',1);
select check_image(omnium_save_draft(0,test_world(array[]::text[]),array['sha256:'||repeat('b',64)]) is null,'stale deletion must conflict');
select check_image((select not delete_requested from omnium_draft_assets),'a conflicted push must not mark deletion');
-- Recovery can temporarily retain a deleted image, then releases it immediately.
update omnium_site_draft set world=test_world(array['sha256:'||repeat('b',64)]);
select omnium_save_draft(3,test_world(array[]::text[]),array['sha256:'||repeat('b',64)]);
select check_image((select delete_requested from omnium_draft_assets),'recovery must remember a deferred deletion');
select omnium_save_draft(4,test_world(array[]::text[]));
select check_image(not exists(select 1 from omnium_draft_assets),'superseded recovery must release the deleted image without waiting 30 minutes');
-- A restored upload cancels a deferred deletion.
select omnium_put_draft_asset('sha256:'||repeat('c',64),'restored','image/png','data',1);
update omnium_draft_assets set delete_requested=true;
update omnium_site_draft set world=test_world(array['sha256:'||repeat('c',64)]);
select omnium_put_draft_asset('sha256:'||repeat('c',64),'restored','image/png','data',1);
select check_image((select not delete_requested from omnium_draft_assets),'reupload must cancel a deferred deletion');
select 'explicit image deletion checks passed; transaction rolled back' as result;
