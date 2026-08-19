\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('43000000-0000-4000-8000-000000000001', 'sole.owner.deletion@local.test'),
  ('43000000-0000-4000-8000-000000000002', 'co.owner.deletion@local.test'),
  ('43000000-0000-4000-8000-000000000003', 'editor.deletion@local.test');

-- Team A: the sole-owner scenario that must block self-deletion.
insert into public.teams (id, name, created_by)
values (
  '53000000-0000-4000-8000-000000000001',
  'Sole Owner Team',
  '43000000-0000-4000-8000-000000000001'
);

insert into public.team_members (team_id, user_id, role)
values
  (
    '53000000-0000-4000-8000-000000000001',
    '43000000-0000-4000-8000-000000000001',
    'owner'
  ),
  (
    '53000000-0000-4000-8000-000000000001',
    '43000000-0000-4000-8000-000000000003',
    'editor'
  );

-- Team B: shared with a co-owner so it is not blocking on its own,
-- and carries content authored by user 1 that must survive anonymized.
insert into public.teams (id, name, created_by)
values (
  '53000000-0000-4000-8000-000000000002',
  'Co-Owned Team',
  '43000000-0000-4000-8000-000000000001'
);

insert into public.team_members (team_id, user_id, role)
values
  (
    '53000000-0000-4000-8000-000000000002',
    '43000000-0000-4000-8000-000000000001',
    'owner'
  ),
  (
    '53000000-0000-4000-8000-000000000002',
    '43000000-0000-4000-8000-000000000002',
    'owner'
  );

insert into public.workspaces (id, team_id, name, created_by)
values (
  '63000000-0000-4000-8000-000000000001',
  '53000000-0000-4000-8000-000000000002',
  'Co-Owned Workspace',
  '43000000-0000-4000-8000-000000000001'
);

insert into public.workspace_members (workspace_id, user_id, role)
select
  '63000000-0000-4000-8000-000000000001',
  member.user_id,
  member.role
from public.team_members member
where member.team_id = '53000000-0000-4000-8000-000000000002';

insert into public.collections (
  id, workspace_id, name, position, created_by, updated_by
)
values (
  '73000000-0000-4000-8000-000000000001',
  '63000000-0000-4000-8000-000000000001',
  'Collection authored by user 1',
  1,
  '43000000-0000-4000-8000-000000000001',
  '43000000-0000-4000-8000-000000000001'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '43000000-0000-4000-8000-000000000001',
  true
);

do $$
begin
  if not exists (
    select 1 from public.list_sole_owner_teams()
    where id = '53000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Sole-owner team was not reported by list_sole_owner_teams';
  end if;

  if exists (
    select 1 from public.list_sole_owner_teams()
    where id = '53000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'Co-owned team was incorrectly reported as sole-owned';
  end if;
end;
$$;

reset role;

-- Deleting the account directly at the SQL level (the API layer normally
-- blocks this while list_sole_owner_teams() is non-empty; here we verify
-- the anonymization and cascade behavior the deletion itself relies on).
delete from auth.users where id = '43000000-0000-4000-8000-000000000001';

do $$
begin
  if exists (
    select 1 from public.team_members
    where user_id = '43000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Membership rows for the deleted user were not cascaded';
  end if;

  if not exists (
    select 1 from public.teams
    where id = '53000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Sole-owner team was unexpectedly removed by the user deletion';
  end if;

  if (
    select created_by from public.teams
    where id = '53000000-0000-4000-8000-000000000002'
  ) is not null then
    raise exception 'Team.created_by was not anonymized after user deletion';
  end if;

  if not exists (
    select 1 from public.collections
    where id = '73000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Shared collection authored by the deleted user was removed';
  end if;

  if (
    select created_by from public.collections
    where id = '73000000-0000-4000-8000-000000000001'
  ) is not null then
    raise exception 'Collection.created_by was not anonymized after user deletion';
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '43000000-0000-4000-8000-000000000002',
  true
);

do $$
begin
  if not public.delete_team('53000000-0000-4000-8000-000000000002') then
    raise exception 'Remaining owner could not delete the co-owned team';
  end if;

  if exists (
    select 1 from public.workspaces
    where id = '63000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Workspace was not cascaded when its team was deleted';
  end if;
end;
$$;

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '43000000-0000-4000-8000-000000000003',
  true
);

do $$
begin
  begin
    perform public.delete_team('53000000-0000-4000-8000-000000000001');
    raise exception 'Non-owner unexpectedly deleted a team';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

reset role;

rollback;
