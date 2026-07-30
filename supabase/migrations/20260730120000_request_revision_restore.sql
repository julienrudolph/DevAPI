alter table public.request_revisions
drop constraint request_revisions_change_type_check;

alter table public.request_revisions
add constraint request_revisions_change_type_check
check (change_type in ('update', 'overwrite', 'restore'));

create or replace function private.sanitized_request_snapshot(
  p_request public.requests
) returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_set(
    to_jsonb(p_request),
    '{headers}',
    coalesce(
      (
        select jsonb_agg(header || jsonb_build_object('value', ''))
        from jsonb_array_elements(p_request.headers) header
      ),
      '[]'::jsonb
    )
  );
$$;

revoke all on function private.sanitized_request_snapshot(public.requests)
from public, anon, authenticated;
grant execute on function private.sanitized_request_snapshot(public.requests)
to authenticated;

update public.request_revisions revision
set snapshot = jsonb_set(
  revision.snapshot,
  '{headers}',
  coalesce(
    (
      select jsonb_agg(header || jsonb_build_object('value', ''))
      from jsonb_array_elements(
        coalesce(revision.snapshot->'headers', '[]'::jsonb)
      ) header
    ),
    '[]'::jsonb
  )
);

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

create or replace function public.list_request_revisions(p_request_id uuid)
returns table (
  id uuid,
  request_id uuid,
  version integer,
  name text,
  method text,
  change_type text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.requests request
    join public.workspace_members member
      on member.workspace_id = request.workspace_id
    where request.id = p_request_id
      and member.user_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  return query
  select
    revision.id,
    revision.request_id,
    revision.version,
    revision.snapshot->>'name',
    revision.snapshot->>'method',
    revision.change_type,
    revision.created_by,
    coalesce(
      nullif(account.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(account.email, '@', 1), ''),
      'Teammitglied'
    )::text,
    revision.created_at
  from public.request_revisions revision
  join auth.users account on account.id = revision.created_by
  where revision.request_id = p_request_id
  order by revision.version desc
  limit 100;
end;
$$;

create or replace function public.restore_request_revision(
  p_request_id uuid,
  p_revision_id uuid,
  p_expected_version integer
) returns public.requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current public.requests;
  v_revision public.request_revisions;
  v_updated public.requests;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
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

  select * into v_revision
  from public.request_revisions
  where id = p_revision_id
    and request_id = p_request_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'REVISION_NOT_FOUND';
  end if;

  insert into public.request_revisions (
    request_id, version, snapshot, created_by, change_type
  ) values (
    v_current.id,
    v_current.version,
    private.sanitized_request_snapshot(v_current),
    auth.uid(),
    'restore'
  );

  update public.requests
  set
    name = v_revision.snapshot->>'name',
    method = v_revision.snapshot->>'method',
    url = v_revision.snapshot->>'url',
    query_params = v_revision.snapshot->'query_params',
    headers = v_revision.snapshot->'headers',
    body = v_revision.snapshot->'body',
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

revoke all on function public.list_request_revisions(uuid)
from public, anon;
revoke all on function public.restore_request_revision(uuid, uuid, integer)
from public, anon;
grant execute on function public.list_request_revisions(uuid) to authenticated;
grant execute on function public.restore_request_revision(uuid, uuid, integer)
to authenticated;
