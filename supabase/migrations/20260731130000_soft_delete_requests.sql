alter table public.requests
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users(id);

create index requests_active_workspace_idx
on public.requests (workspace_id)
where deleted_at is null;

alter table public.request_revisions
  drop constraint request_revisions_change_type_check;

alter table public.request_revisions
  add constraint request_revisions_change_type_check
  check (change_type in ('update', 'overwrite', 'restore', 'delete'));

drop policy "members can read requests" on public.requests;
create policy "members can read requests"
on public.requests for select
using (
  deleted_at is null
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = requests.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy "editors can update requests" on public.requests;
create policy "editors can update requests"
on public.requests for update
using (
  deleted_at is null
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = requests.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'editor')
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = requests.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'editor')
  )
);

create or replace function public.soft_delete_request(
  p_request_id uuid,
  p_expected_version integer
) returns public.requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current public.requests;
  v_deleted public.requests;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_EXPECTED_VERSION';
  end if;

  select * into v_current
  from public.requests
  where id = p_request_id
    and deleted_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'REQUEST_NOT_FOUND';
  end if;
  if v_current.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'REQUEST_VERSION_CONFLICT';
  end if;

  insert into public.request_revisions (
    request_id, version, snapshot, created_by, change_type
  ) values (
    v_current.id,
    v_current.version,
    private.sanitized_request_snapshot(v_current),
    auth.uid(),
    'delete'
  );

  update public.requests
  set
    deleted_at = now(),
    deleted_by = auth.uid(),
    version = version + 1,
    updated_by = auth.uid(),
    updated_at = now()
  where id = p_request_id
    and version = p_expected_version
    and deleted_at is null
  returning * into v_deleted;

  if not found then
    raise exception using errcode = '40001', message = 'REQUEST_VERSION_CONFLICT';
  end if;
  return v_deleted;
end;
$$;

revoke all on function public.soft_delete_request(uuid, integer)
from public, anon;
grant execute on function public.soft_delete_request(uuid, integer)
to authenticated;
