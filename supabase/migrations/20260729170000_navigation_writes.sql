create schema if not exists private;

create or replace function private.folder_parent_is_valid(
  p_parent_folder_id uuid,
  p_workspace_id uuid,
  p_collection_id uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.folders parent
    where parent.id = p_parent_folder_id
      and parent.workspace_id = p_workspace_id
      and parent.collection_id = p_collection_id
  );
$$;

revoke all on function private.folder_parent_is_valid(uuid, uuid, uuid)
from public;
grant usage on schema private to authenticated;
grant execute on function private.folder_parent_is_valid(uuid, uuid, uuid)
to authenticated;

create policy "editors can create folders"
on public.folders for insert
with check (
  created_by = auth.uid()
  and updated_by = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = folders.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'editor')
  )
  and exists (
    select 1
    from public.collections c
    where c.id = folders.collection_id
      and c.workspace_id = folders.workspace_id
  )
  and (
    folders.parent_folder_id is null
    or private.folder_parent_is_valid(
      folders.parent_folder_id,
      folders.workspace_id,
      folders.collection_id
    )
  )
);

create policy "editors can create requests"
on public.requests for insert
with check (
  created_by = auth.uid()
  and updated_by = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = requests.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'editor')
  )
  and exists (
    select 1
    from public.collections c
    where c.id = requests.collection_id
      and c.workspace_id = requests.workspace_id
  )
  and (
    requests.folder_id is null
    or exists (
      select 1
      from public.folders f
      where f.id = requests.folder_id
        and f.workspace_id = requests.workspace_id
        and f.collection_id = requests.collection_id
    )
  )
);

grant insert on public.requests to authenticated;
