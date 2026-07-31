alter table public.folders
  add column version integer not null default 1 check (version > 0);

create or replace function public.delete_empty_collection(
  p_collection_id uuid,
  p_expected_version integer
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_collection public.collections;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_EXPECTED_VERSION';
  end if;

  select * into v_collection
  from public.collections
  where id = p_collection_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'COLLECTION_NOT_FOUND';
  end if;
  if not exists (
    select 1
    from public.workspace_members membership
    where membership.workspace_id = v_collection.workspace_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'editor')
  ) then
    raise exception using errcode = '42501', message = 'COLLECTION_DELETE_FORBIDDEN';
  end if;
  if v_collection.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'COLLECTION_VERSION_CONFLICT';
  end if;
  if exists (
    select 1 from public.folders
    where collection_id = p_collection_id
  ) or exists (
    select 1 from public.requests
    where collection_id = p_collection_id
      and deleted_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'COLLECTION_NOT_EMPTY';
  end if;

  delete from public.collections
  where id = p_collection_id
    and version = p_expected_version;

  if not found then
    raise exception using errcode = '40001', message = 'COLLECTION_VERSION_CONFLICT';
  end if;
end;
$$;

create or replace function public.delete_empty_folder(
  p_folder_id uuid,
  p_expected_version integer
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_folder public.folders;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_EXPECTED_VERSION';
  end if;

  select * into v_folder
  from public.folders
  where id = p_folder_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'FOLDER_NOT_FOUND';
  end if;
  if not exists (
    select 1
    from public.workspace_members membership
    where membership.workspace_id = v_folder.workspace_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'editor')
  ) then
    raise exception using errcode = '42501', message = 'FOLDER_DELETE_FORBIDDEN';
  end if;
  if v_folder.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'FOLDER_VERSION_CONFLICT';
  end if;
  if exists (
    select 1 from public.folders
    where parent_folder_id = p_folder_id
  ) or exists (
    select 1 from public.requests
    where folder_id = p_folder_id
      and deleted_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'FOLDER_NOT_EMPTY';
  end if;

  delete from public.folders
  where id = p_folder_id
    and version = p_expected_version;

  if not found then
    raise exception using errcode = '40001', message = 'FOLDER_VERSION_CONFLICT';
  end if;
end;
$$;

revoke all on function public.delete_empty_collection(uuid, integer)
from public, anon;
revoke all on function public.delete_empty_folder(uuid, integer)
from public, anon;
grant execute on function public.delete_empty_collection(uuid, integer)
to authenticated;
grant execute on function public.delete_empty_folder(uuid, integer)
to authenticated;
