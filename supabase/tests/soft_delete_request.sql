\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('11000000-0000-4000-8000-000000000001', 'editor.delete@local.test'),
  ('11000000-0000-4000-8000-000000000002', 'viewer.delete@local.test');

insert into public.teams (id, name, created_by)
values (
  '21000000-0000-4000-8000-000000000001',
  'Delete Integration Team',
  '11000000-0000-4000-8000-000000000001'
);

insert into public.workspaces (id, team_id, name, created_by)
values (
  '31000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000001',
  'Delete Integration Workspace',
  '11000000-0000-4000-8000-000000000001'
);

insert into public.workspace_members (workspace_id, user_id, role)
values
  (
    '31000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    'editor'
  ),
  (
    '31000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000002',
    'viewer'
  );

insert into public.requests (
  id,
  workspace_id,
  name,
  method,
  url,
  headers,
  created_by,
  updated_by
) values (
  '41000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001',
  'Request to delete',
  'GET',
  'https://example.test',
  '[{"id":"51000000-0000-4000-8000-000000000001","key":"Authorization","value":"Bearer secret","enabled":true}]',
  '11000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000001'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11000000-0000-4000-8000-000000000002',
  true
);

do $$
begin
  begin
    perform public.soft_delete_request(
      '41000000-0000-4000-8000-000000000001',
      1
    );
    raise exception 'Viewer unexpectedly deleted a request';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '11000000-0000-4000-8000-000000000001',
  true
);

do $$
begin
  begin
    perform public.soft_delete_request(
      '41000000-0000-4000-8000-000000000001',
      2
    );
    raise exception 'Stale request version was accepted';
  exception
    when serialization_failure then
      null;
  end;
end;
$$;

select public.soft_delete_request(
  '41000000-0000-4000-8000-000000000001',
  1
);

do $$
begin
  if exists (
    select 1 from public.requests
    where id = '41000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Soft-deleted request is still visible through RLS';
  end if;
end;
$$;

reset role;

do $$
declare
  v_request public.requests;
  v_revision public.request_revisions;
begin
  select * into strict v_request
  from public.requests
  where id = '41000000-0000-4000-8000-000000000001';

  if v_request.deleted_at is null
    or v_request.deleted_by <> '11000000-0000-4000-8000-000000000001'
    or v_request.version <> 2
  then
    raise exception 'Soft-delete metadata or version is incorrect';
  end if;

  select * into strict v_revision
  from public.request_revisions
  where request_id = v_request.id
    and version = 1;

  if v_revision.change_type <> 'delete'
    or v_revision.snapshot #>> '{headers,0,value}' <> ''
  then
    raise exception 'Delete revision is missing or contains a header secret';
  end if;
end;
$$;

rollback;
