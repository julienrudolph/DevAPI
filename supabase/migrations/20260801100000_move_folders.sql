create or replace function public.move_folder_navigation(
  p_folder_id uuid,
  p_expected_version integer,
  p_collection_id uuid,
  p_parent_folder_id uuid default null
) returns public.folders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_folder public.folders;
  v_parent public.folders;
  v_position integer;
  v_updated public.folders;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if p_expected_version < 1 or p_collection_id is null then
    raise exception using errcode = '22023', message = 'INVALID_FOLDER_MOVE';
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
    raise exception using errcode = '42501', message = 'FOLDER_MOVE_FORBIDDEN';
  end if;
  if v_folder.version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'FOLDER_VERSION_CONFLICT';
  end if;
  if not exists (
    select 1 from public.collections collection
    where collection.id = p_collection_id
      and collection.workspace_id = v_folder.workspace_id
  ) then
    raise exception using errcode = '22023', message = 'INVALID_TARGET_COLLECTION';
  end if;
  if p_parent_folder_id = p_folder_id then
    raise exception using errcode = '22023', message = 'FOLDER_MOVE_CYCLE';
  end if;

  if p_parent_folder_id is not null then
    select * into v_parent
    from public.folders
    where id = p_parent_folder_id
    for update;

    if not found
      or v_parent.workspace_id <> v_folder.workspace_id
      or v_parent.collection_id <> p_collection_id
    then
      raise exception using errcode = '22023', message = 'INVALID_TARGET_FOLDER';
    end if;

    if exists (
      with recursive descendants as (
        select child.id
        from public.folders child
        where child.parent_folder_id = p_folder_id
        union all
        select child.id
        from public.folders child
        join descendants parent on child.parent_folder_id = parent.id
      )
      select 1 from descendants where id = p_parent_folder_id
    ) then
      raise exception using errcode = '22023', message = 'FOLDER_MOVE_CYCLE';
    end if;
  end if;

  select coalesce(max(position), -1) + 1 into v_position
  from public.folders
  where collection_id = p_collection_id
    and parent_folder_id is not distinct from p_parent_folder_id
    and id <> p_folder_id;

  if v_folder.collection_id <> p_collection_id then
    perform request.id
    from public.requests request
    where request.folder_id in (
      with recursive subtree as (
        select id from public.folders where id = p_folder_id
        union all
        select child.id
        from public.folders child
        join subtree parent on child.parent_folder_id = parent.id
      )
      select id from subtree
    )
    order by request.id
    for update;

    insert into public.request_revisions (
      request_id, version, snapshot, created_by, change_type
    )
    select
      request.id,
      request.version,
      private.sanitized_request_snapshot(request),
      auth.uid(),
      'update'
    from public.requests request
    where request.folder_id in (
      with recursive subtree as (
        select id from public.folders where id = p_folder_id
        union all
        select child.id
        from public.folders child
        join subtree parent on child.parent_folder_id = parent.id
      )
      select id from subtree
    );

    update public.requests request
    set
      collection_id = p_collection_id,
      version = version + 1,
      updated_by = auth.uid(),
      updated_at = now()
    where request.folder_id in (
      with recursive subtree as (
        select id from public.folders where id = p_folder_id
        union all
        select child.id
        from public.folders child
        join subtree parent on child.parent_folder_id = parent.id
      )
      select id from subtree
    );
  end if;

  with recursive subtree as (
    select id from public.folders where id = p_folder_id
    union all
    select child.id
    from public.folders child
    join subtree parent on child.parent_folder_id = parent.id
  )
  update public.folders folder
  set
    collection_id = p_collection_id,
    parent_folder_id = case
      when folder.id = p_folder_id then p_parent_folder_id
      else folder.parent_folder_id
    end,
    position = case
      when folder.id = p_folder_id then v_position
      else folder.position
    end,
    version = version + 1,
    updated_by = auth.uid(),
    updated_at = now()
  from subtree
  where folder.id = subtree.id;

  select * into strict v_updated
  from public.folders
  where id = p_folder_id;
  return v_updated;
end;
$$;

revoke all on function public.move_folder_navigation(
  uuid, integer, uuid, uuid
) from public, anon;
grant execute on function public.move_folder_navigation(
  uuid, integer, uuid, uuid
) to authenticated;
