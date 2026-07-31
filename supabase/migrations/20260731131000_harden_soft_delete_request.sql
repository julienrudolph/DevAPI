create or replace function public.soft_delete_request(
  p_request_id uuid,
  p_expected_version integer
) returns public.requests
language plpgsql
security definer
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
  if not exists (
    select 1
    from public.workspace_members membership
    where membership.workspace_id = v_current.workspace_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'editor')
  ) then
    raise exception using errcode = '42501', message = 'REQUEST_DELETE_FORBIDDEN';
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
