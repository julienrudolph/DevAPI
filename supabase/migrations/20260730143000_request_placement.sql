create or replace function public.update_request_with_revision(
  p_request_id uuid,
  p_expected_version integer,
  p_draft jsonb,
  p_change_type text default 'update'
) returns public.requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current public.requests;
  v_updated public.requests;
  v_collection_id uuid;
  v_folder_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_EXPECTED_VERSION';
  end if;
  if p_change_type not in ('update', 'overwrite') then
    raise exception using errcode = '22023', message = 'INVALID_CHANGE_TYPE';
  end if;
  if jsonb_typeof(p_draft) <> 'object'
    or nullif(btrim(p_draft->>'name'), '') is null
    or p_draft->>'method' not in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')
    or nullif(btrim(p_draft->>'url'), '') is null
    or jsonb_typeof(p_draft->'queryParams') <> 'array'
    or jsonb_typeof(p_draft->'headers') <> 'array'
    or jsonb_typeof(p_draft->'body') <> 'object'
  then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST_DRAFT';
  end if;

  select * into v_current
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'REQUEST_NOT_FOUND';
  end if;
  if v_current.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'REQUEST_VERSION_CONFLICT';
  end if;

  v_collection_id := case
    when p_draft ? 'collectionId' then (p_draft->>'collectionId')::uuid
    else v_current.collection_id
  end;
  v_folder_id := case
    when p_draft ? 'folderId' and p_draft->'folderId' <> 'null'::jsonb
      then (p_draft->>'folderId')::uuid
    when p_draft ? 'folderId' then null
    else v_current.folder_id
  end;

  if not exists (
    select 1 from public.collections collection
    where collection.id = v_collection_id
      and collection.workspace_id = v_current.workspace_id
  ) then
    raise exception using errcode = '22023', message = 'INVALID_COLLECTION';
  end if;
  if v_folder_id is not null and not exists (
    select 1 from public.folders folder
    where folder.id = v_folder_id
      and folder.workspace_id = v_current.workspace_id
      and folder.collection_id = v_collection_id
  ) then
    raise exception using errcode = '22023', message = 'INVALID_FOLDER';
  end if;

  insert into public.request_revisions (
    request_id, version, snapshot, created_by, change_type
  ) values (
    v_current.id,
    v_current.version,
    private.sanitized_request_snapshot(v_current),
    auth.uid(),
    p_change_type
  );

  update public.requests
  set
    collection_id = v_collection_id,
    folder_id = v_folder_id,
    name = p_draft->>'name',
    method = p_draft->>'method',
    url = p_draft->>'url',
    query_params = p_draft->'queryParams',
    headers = p_draft->'headers',
    body = p_draft->'body',
    version = version + 1,
    updated_by = auth.uid(),
    updated_at = now()
  where id = p_request_id and version = p_expected_version
  returning * into v_updated;

  if not found then
    raise exception using errcode = '40001', message = 'REQUEST_VERSION_CONFLICT';
  end if;
  return v_updated;
end;
$$;
