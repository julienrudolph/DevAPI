\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('15000000-0000-4000-8000-000000000001', 'editor.move@local.test'),
  ('15000000-0000-4000-8000-000000000002', 'viewer.move@local.test');

insert into public.teams (id, name, created_by)
values (
  '25000000-0000-4000-8000-000000000001',
  'Folder Move Team',
  '15000000-0000-4000-8000-000000000001'
);

insert into public.workspaces (id, team_id, name, created_by)
values (
  '35000000-0000-4000-8000-000000000001',
  '25000000-0000-4000-8000-000000000001',
  'Folder Move Workspace',
  '15000000-0000-4000-8000-000000000001'
);

insert into public.workspace_members (workspace_id, user_id, role)
values
  (
    '35000000-0000-4000-8000-000000000001',
    '15000000-0000-4000-8000-000000000001',
    'editor'
  ),
  (
    '35000000-0000-4000-8000-000000000001',
    '15000000-0000-4000-8000-000000000002',
    'viewer'
  );

insert into public.collections (
  id, workspace_id, name, position, created_by, updated_by
) values
  (
    '45000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000001',
    'Source',
    0,
    '15000000-0000-4000-8000-000000000001',
    '15000000-0000-4000-8000-000000000001'
  ),
  (
    '45000000-0000-4000-8000-000000000002',
    '35000000-0000-4000-8000-000000000001',
    'Destination',
    1,
    '15000000-0000-4000-8000-000000000001',
    '15000000-0000-4000-8000-000000000001'
  );

insert into public.folders (
  id, workspace_id, collection_id, parent_folder_id, name, position,
  created_by, updated_by
) values
  (
    '55000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000001',
    '45000000-0000-4000-8000-000000000001',
    null,
    'Parent',
    0,
    '15000000-0000-4000-8000-000000000001',
    '15000000-0000-4000-8000-000000000001'
  ),
  (
    '55000000-0000-4000-8000-000000000002',
    '35000000-0000-4000-8000-000000000001',
    '45000000-0000-4000-8000-000000000001',
    '55000000-0000-4000-8000-000000000001',
    'Child',
    0,
    '15000000-0000-4000-8000-000000000001',
    '15000000-0000-4000-8000-000000000001'
  );

insert into public.requests (
  id, workspace_id, collection_id, folder_id, name, method, url,
  created_by, updated_by
) values (
  '65000000-0000-4000-8000-000000000001',
  '35000000-0000-4000-8000-000000000001',
  '45000000-0000-4000-8000-000000000001',
  '55000000-0000-4000-8000-000000000002',
  'Nested request',
  'GET',
  'https://example.test',
  '15000000-0000-4000-8000-000000000001',
  '15000000-0000-4000-8000-000000000001'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '15000000-0000-4000-8000-000000000002',
  true
);

do $$
begin
  begin
    perform public.move_folder_navigation(
      '55000000-0000-4000-8000-000000000001',
      1,
      '45000000-0000-4000-8000-000000000002',
      null
    );
    raise exception 'Viewer unexpectedly moved a folder';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '15000000-0000-4000-8000-000000000001',
  true
);

do $$
begin
  begin
    perform public.move_folder_navigation(
      '55000000-0000-4000-8000-000000000001',
      1,
      '45000000-0000-4000-8000-000000000001',
      '55000000-0000-4000-8000-000000000002'
    );
    raise exception 'Folder cycle was accepted';
  exception
    when invalid_parameter_value then null;
  end;
end;
$$;

select public.move_folder_navigation(
  '55000000-0000-4000-8000-000000000001',
  1,
  '45000000-0000-4000-8000-000000000002',
  null
);

do $$
begin
  if not exists (
    select 1 from public.folders
    where id = '55000000-0000-4000-8000-000000000001'
      and collection_id = '45000000-0000-4000-8000-000000000002'
      and parent_folder_id is null
      and version = 2
  ) or not exists (
    select 1 from public.folders
    where id = '55000000-0000-4000-8000-000000000002'
      and collection_id = '45000000-0000-4000-8000-000000000002'
      and parent_folder_id = '55000000-0000-4000-8000-000000000001'
  ) or not exists (
    select 1 from public.requests
    where id = '65000000-0000-4000-8000-000000000001'
      and collection_id = '45000000-0000-4000-8000-000000000002'
      and folder_id = '55000000-0000-4000-8000-000000000002'
      and version = 2
  ) or not exists (
    select 1 from public.request_revisions
    where request_id = '65000000-0000-4000-8000-000000000001'
      and version = 1
  ) then
    raise exception 'Folder subtree was not moved consistently';
  end if;
end;
$$;

do $$
begin
  begin
    perform public.move_folder_navigation(
      '55000000-0000-4000-8000-000000000001',
      1,
      '45000000-0000-4000-8000-000000000001',
      null
    );
    raise exception 'Stale folder move was accepted';
  exception
    when raise_exception then
      if sqlerrm <> 'FOLDER_VERSION_CONFLICT' then
        raise;
      end if;
  end;
end;
$$;

reset role;
rollback;
