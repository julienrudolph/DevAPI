\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('12000000-0000-4000-8000-000000000001', 'editor.environment@local.test'),
  ('12000000-0000-4000-8000-000000000002', 'viewer.environment@local.test'),
  ('12000000-0000-4000-8000-000000000003', 'outsider.environment@local.test');

insert into public.teams (id, name, created_by)
values (
  '22000000-0000-4000-8000-000000000001',
  'Environment RLS Team',
  '12000000-0000-4000-8000-000000000001'
);

insert into public.workspaces (id, team_id, name, created_by)
values (
  '32000000-0000-4000-8000-000000000001',
  '22000000-0000-4000-8000-000000000001',
  'Environment RLS Workspace',
  '12000000-0000-4000-8000-000000000001'
);

insert into public.workspace_members (workspace_id, user_id, role)
values
  (
    '32000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001',
    'editor'
  ),
  (
    '32000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000002',
    'viewer'
  );

insert into public.environments (
  id, workspace_id, name, created_by, updated_by
) values (
  '42000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001',
  'Integration',
  '12000000-0000-4000-8000-000000000001',
  '12000000-0000-4000-8000-000000000001'
);

insert into public.environment_variables (
  id, environment_id, key, value, scope, owner_user_id, created_by, updated_by
) values
  (
    '52000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000001',
    'baseUrl',
    'https://api.example.test',
    'shared',
    null,
    '12000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001'
  ),
  (
    '52000000-0000-4000-8000-000000000002',
    '42000000-0000-4000-8000-000000000001',
    'editorToken',
    'editor-secret',
    'personal',
    '12000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '12000000-0000-4000-8000-000000000002',
  true
);

do $$
begin
  if (select count(*) from public.environments) <> 1 then
    raise exception 'Viewer cannot read its workspace environment';
  end if;
  if (select count(*) from public.environment_variables) <> 1 then
    raise exception 'Viewer can see another member''s personal variable';
  end if;

  begin
    insert into public.environment_variables (
      environment_id, key, value, scope, created_by, updated_by
    ) values (
      '42000000-0000-4000-8000-000000000001',
      'viewerShared',
      'must-not-exist',
      'shared',
      '12000000-0000-4000-8000-000000000002',
      '12000000-0000-4000-8000-000000000002'
    );
    raise exception 'Viewer unexpectedly created a shared variable';
  exception
    when insufficient_privilege then
      null;
  end;

  insert into public.environment_variables (
    id, environment_id, key, value, scope, owner_user_id, created_by, updated_by
  ) values (
    '52000000-0000-4000-8000-000000000003',
    '42000000-0000-4000-8000-000000000001',
    'viewerToken',
    'viewer-secret',
    'personal',
    '12000000-0000-4000-8000-000000000002',
    '12000000-0000-4000-8000-000000000002',
    '12000000-0000-4000-8000-000000000002'
  );

  update public.environment_variables
  set value = 'updated-viewer-secret',
      version = version + 1,
      updated_by = '12000000-0000-4000-8000-000000000002'
  where id = '52000000-0000-4000-8000-000000000003'
    and version = 1;

  if not found then
    raise exception 'Viewer could not update its personal variable';
  end if;

  update public.environment_variables
  set value = 'must-not-change',
      version = version + 1,
      updated_by = '12000000-0000-4000-8000-000000000002'
  where id = '52000000-0000-4000-8000-000000000001'
    and version = 1;

  if found then
    raise exception 'Viewer unexpectedly updated a shared variable';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '12000000-0000-4000-8000-000000000003',
  true
);

do $$
begin
  if exists (select 1 from public.environments)
    or exists (select 1 from public.environment_variables)
  then
    raise exception 'Outsider can read environment data';
  end if;
end;
$$;

reset role;
delete from public.workspace_members
where workspace_id = '32000000-0000-4000-8000-000000000001'
  and user_id = '12000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '12000000-0000-4000-8000-000000000002',
  true
);

do $$
begin
  if exists (select 1 from public.environments)
    or exists (select 1 from public.environment_variables)
  then
    raise exception 'Revoked member can still read environment data';
  end if;
end;
$$;

rollback;
