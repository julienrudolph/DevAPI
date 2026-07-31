create or replace function public.update_collection_navigation(
  p_collection_id uuid,
  p_expected_version integer,
  p_name text default null,
  p_target_position integer default null
) returns public.collections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_collection public.collections;
  v_ids uuid[];
  v_remaining uuid[];
  v_length integer;
  v_target integer;
  v_updated public.collections;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if p_expected_version < 1 or (p_name is null and p_target_position is null) then
    raise exception using errcode = '22023', message = 'INVALID_COLLECTION_UPDATE';
  end if;
  if p_name is not null then
    p_name := nullif(btrim(p_name), '');
    if p_name is null or char_length(p_name) > 160 then
      raise exception using errcode = '22023', message = 'INVALID_COLLECTION_NAME';
    end if;
  end if;

  select * into v_collection
  from public.collections
  where id = p_collection_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'COLLECTION_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.workspace_members membership
    where membership.workspace_id = v_collection.workspace_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'editor')
  ) then
    raise exception using errcode = '42501', message = 'COLLECTION_UPDATE_FORBIDDEN';
  end if;
  if v_collection.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'COLLECTION_VERSION_CONFLICT';
  end if;

  perform 1
  from public.collections
  where workspace_id = v_collection.workspace_id
  order by id
  for update;

  if p_target_position is not null then
    select array_agg(id order by position, id) into v_ids
    from public.collections
    where workspace_id = v_collection.workspace_id;
    v_remaining := array_remove(v_ids, p_collection_id);
    v_length := coalesce(array_length(v_remaining, 1), 0);
    v_target := greatest(0, least(p_target_position, v_length));

    if v_target = 0 then
      v_ids := array[p_collection_id] || coalesce(v_remaining, '{}'::uuid[]);
    elsif v_target = v_length then
      v_ids := coalesce(v_remaining, '{}'::uuid[]) || array[p_collection_id];
    else
      v_ids :=
        v_remaining[1:v_target]
        || array[p_collection_id]
        || v_remaining[v_target + 1:v_length];
    end if;

    update public.collections collection
    set
      position = ordering.ordinality - 1,
      name = case
        when collection.id = p_collection_id and p_name is not null
          then p_name
        else collection.name
      end,
      version = version + 1,
      updated_by = auth.uid(),
      updated_at = now()
    from unnest(v_ids) with ordinality ordering(id, ordinality)
    where collection.id = ordering.id
      and (
        collection.position <> ordering.ordinality - 1
        or collection.id = p_collection_id
      );
  else
    update public.collections
    set
      name = p_name,
      version = version + 1,
      updated_by = auth.uid(),
      updated_at = now()
    where id = p_collection_id
      and version = p_expected_version;
  end if;

  select * into strict v_updated
  from public.collections
  where id = p_collection_id;
  return v_updated;
end;
$$;

create or replace function public.update_folder_navigation(
  p_folder_id uuid,
  p_expected_version integer,
  p_name text default null,
  p_target_position integer default null
) returns public.folders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_folder public.folders;
  v_ids uuid[];
  v_remaining uuid[];
  v_length integer;
  v_target integer;
  v_updated public.folders;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if p_expected_version < 1 or (p_name is null and p_target_position is null) then
    raise exception using errcode = '22023', message = 'INVALID_FOLDER_UPDATE';
  end if;
  if p_name is not null then
    p_name := nullif(btrim(p_name), '');
    if p_name is null or char_length(p_name) > 160 then
      raise exception using errcode = '22023', message = 'INVALID_FOLDER_NAME';
    end if;
  end if;

  select * into v_folder
  from public.folders
  where id = p_folder_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'FOLDER_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.workspace_members membership
    where membership.workspace_id = v_folder.workspace_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'editor')
  ) then
    raise exception using errcode = '42501', message = 'FOLDER_UPDATE_FORBIDDEN';
  end if;
  if v_folder.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'FOLDER_VERSION_CONFLICT';
  end if;

  perform 1
  from public.folders
  where collection_id = v_folder.collection_id
    and parent_folder_id is not distinct from v_folder.parent_folder_id
  order by id
  for update;

  if p_target_position is not null then
    select array_agg(id order by position, id) into v_ids
    from public.folders
    where collection_id = v_folder.collection_id
      and parent_folder_id is not distinct from v_folder.parent_folder_id;
    v_remaining := array_remove(v_ids, p_folder_id);
    v_length := coalesce(array_length(v_remaining, 1), 0);
    v_target := greatest(0, least(p_target_position, v_length));

    if v_target = 0 then
      v_ids := array[p_folder_id] || coalesce(v_remaining, '{}'::uuid[]);
    elsif v_target = v_length then
      v_ids := coalesce(v_remaining, '{}'::uuid[]) || array[p_folder_id];
    else
      v_ids :=
        v_remaining[1:v_target]
        || array[p_folder_id]
        || v_remaining[v_target + 1:v_length];
    end if;

    update public.folders folder
    set
      position = ordering.ordinality - 1,
      name = case
        when folder.id = p_folder_id and p_name is not null then p_name
        else folder.name
      end,
      version = version + 1,
      updated_by = auth.uid(),
      updated_at = now()
    from unnest(v_ids) with ordinality ordering(id, ordinality)
    where folder.id = ordering.id
      and (
        folder.position <> ordering.ordinality - 1
        or folder.id = p_folder_id
      );
  else
    update public.folders
    set
      name = p_name,
      version = version + 1,
      updated_by = auth.uid(),
      updated_at = now()
    where id = p_folder_id
      and version = p_expected_version;
  end if;

  select * into strict v_updated
  from public.folders
  where id = p_folder_id;
  return v_updated;
end;
$$;

revoke all on function public.update_collection_navigation(
  uuid, integer, text, integer
) from public, anon;
revoke all on function public.update_folder_navigation(
  uuid, integer, text, integer
) from public, anon;
grant execute on function public.update_collection_navigation(
  uuid, integer, text, integer
) to authenticated;
grant execute on function public.update_folder_navigation(
  uuid, integer, text, integer
) to authenticated;
