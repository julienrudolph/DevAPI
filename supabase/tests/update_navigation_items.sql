\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('13000000-0000-4000-8000-000000000001', 'editor.order@local.test'),
  ('13000000-0000-4000-8000-000000000002', 'viewer.order@local.test');

insert into public.teams (id, name, created_by)
values (
  '23000000-0000-4000-8000-000000000001',
  'Ordering Integration Team',
  '13000000-0000-4000-8000-000000000001'
);

insert into public.workspaces (id, team_id, name, created_by)
values (
  '33000000-0000-4000-8000-000000000001',
  '23000000-0000-4000-8000-000000000001',
  'Ordering Integration Workspace',
  '13000000-0000-4000-8000-000000000001'
);

insert into public.workspace_members (workspace_id, user_id, role)
values
  (
    '33000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000001',
    'editor'
  ),
  (
    '33000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000002',
    'viewer'
  );

insert into public.collections (
  id, workspace_id, name, position, created_by, updated_by
) values
  (
    '43000000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000001',
    'First',
    0,
    '13000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000001'
  ),
  (
    '43000000-0000-4000-8000-000000000002',
    '33000000-0000-4000-8000-000000000001',
    'Second',
    1,
    '13000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000001'
  );

insert into public.folders (
  id, workspace_id, collection_id, name, position, created_by, updated_by
) values
  (
    '53000000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000001',
    '43000000-0000-4000-8000-000000000001',
    'Folder A',
    0,
    '13000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000001'
  ),
  (
    '53000000-0000-4000-8000-000000000002',
    '33000000-0000-4000-8000-000000000001',
    '43000000-0000-4000-8000-000000000001',
    'Folder B',
    1,
    '13000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000001'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '13000000-0000-4000-8000-000000000002',
  true
);

do $$
begin
  begin
    perform public.update_collection_navigation(
      '43000000-0000-4000-8000-000000000001',
      1,
      'Forbidden',
      null
    );
    raise exception 'Viewer unexpectedly renamed a collection';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '13000000-0000-4000-8000-000000000001',
  true
);

do $$
begin
  begin
    perform public.update_folder_navigation(
      '53000000-0000-4000-8000-000000000001',
      2,
      null,
      1
    );
    raise exception 'Stale folder version was accepted';
  exception
    when serialization_failure then null;
  end;
end;
$$;

select public.update_collection_navigation(
  '43000000-0000-4000-8000-000000000001',
  1,
  'Renamed first',
  1
);

select public.update_folder_navigation(
  '53000000-0000-4000-8000-000000000001',
  1,
  'Renamed folder',
  1
);

reset role;

do $$
begin
  if not exists (
    select 1 from public.collections
    where id = '43000000-0000-4000-8000-000000000001'
      and name = 'Renamed first'
      and position = 1
      and version = 2
  ) or not exists (
    select 1 from public.collections
    where id = '43000000-0000-4000-8000-000000000002'
      and position = 0
      and version = 2
  ) then
    raise exception 'Collection rename/reorder was not atomic';
  end if;

  if not exists (
    select 1 from public.folders
    where id = '53000000-0000-4000-8000-000000000001'
      and name = 'Renamed folder'
      and position = 1
      and version = 2
  ) or not exists (
    select 1 from public.folders
    where id = '53000000-0000-4000-8000-000000000002'
      and position = 0
      and version = 2
  ) then
    raise exception 'Folder rename/reorder was not atomic';
  end if;
end;
$$;

rollback;
