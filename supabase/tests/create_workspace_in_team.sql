\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('10000000-0000-4000-8000-000000000001', 'owner.integration@local.test'),
  ('10000000-0000-4000-8000-000000000002', 'editor.integration@local.test'),
  ('10000000-0000-4000-8000-000000000003', 'outsider.integration@local.test');

insert into public.teams (id, name, created_by)
values (
  '20000000-0000-4000-8000-000000000001',
  'RLS Integration Team',
  '10000000-0000-4000-8000-000000000001'
);

insert into public.team_members (team_id, user_id, role)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'owner'
  ),
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    'editor'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

create temporary table test_context (
  created_workspace_id uuid not null
) on commit drop;

insert into test_context (created_workspace_id)
select id
from public.create_workspace_in_team(
  '20000000-0000-4000-8000-000000000001',
  'Owner-created Workspace'
);

do $$
begin
  if not exists (
    select 1
    from public.workspaces
    where id = (select created_workspace_id from test_context)
  ) then
    raise exception 'Owner cannot read the newly created workspace';
  end if;
end;
$$;

reset role;

do $$
begin
  if (
    select count(*)
    from public.workspace_members
    where workspace_id = (select created_workspace_id from test_context)
  ) <> 2 then
    raise exception 'Not all team members were copied to the workspace';
  end if;

  if not exists (
    select 1
    from public.workspace_members
    where workspace_id = (select created_workspace_id from test_context)
      and user_id = '10000000-0000-4000-8000-000000000002'
      and role = 'editor'
  ) then
    raise exception 'The editor role was not preserved';
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  true
);

do $$
begin
  if not exists (
    select 1
    from public.workspaces
    where id = (select created_workspace_id from test_context)
  ) then
    raise exception 'Copied team member cannot read the workspace';
  end if;

  begin
    perform *
    from public.create_workspace_in_team(
      '20000000-0000-4000-8000-000000000001',
      'Forbidden editor workspace'
    );
    raise exception 'Editor unexpectedly created a workspace';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000003',
  true
);

do $$
begin
  if exists (
    select 1
    from public.workspaces
    where id = (select created_workspace_id from test_context)
  ) then
    raise exception 'Cross-tenant workspace read was not blocked by RLS';
  end if;

  begin
    perform *
    from public.create_workspace_in_team(
      '20000000-0000-4000-8000-000000000001',
      'Forbidden outsider workspace'
    );
    raise exception 'Outsider unexpectedly created a workspace';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

reset role;
rollback;
