-- Storage's pre-upload probe supplies MIME/contentLength but not the actual size.
-- Its final insert includes server-computed size/type. Match those against the
-- reservation so underdeclared uploads cannot bypass reserved-byte quotas.
create function private.can_upload_asset(p_key text, p_metadata jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.assets a
    where a.object_key = p_key and a.state = 'pending' and a.created_by = (select auth.uid())
    and private.workspace_role(a.workspace_id) in ('owner','editor')
    and case
      when p_metadata is null or not (p_metadata ? 'size') then true
      when jsonb_typeof(p_metadata->'size') = 'number' then
        (p_metadata->>'size')::bigint = a.byte_size and p_metadata->>'mimetype' = a.media_type
      else false
    end);
$$;
revoke all on function private.can_upload_asset(text, jsonb) from public, anon;
grant execute on function private.can_upload_asset(text, jsonb) to authenticated;
drop policy asset_object_insert on storage.objects;
create policy asset_object_insert on storage.objects for insert to authenticated
with check (bucket_id = 'workspace-assets' and (select private.can_upload_asset(name, metadata)));
drop function private.can_upload_asset(text);
