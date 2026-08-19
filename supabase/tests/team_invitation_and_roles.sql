\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('13000000-0000-4000-8000-000000000001', 'owner.invitation@local.test'),
  ('13000000-0000-4000-8000-000000000002', 'editor.invitation@local.test'),
  ('13000000-0000-4000-8000-000000000003', 'invitee.invitation@local.test');

insert into public.teams (id, name, created_by)
values (
  '23000000-0000-4000-8000-000000000001',
  'Invitation Integration Team',
  '13000000-0000-4000-8000-000000000001'
);

insert into public.team_members (team_id, user_id, role)
values
  (
    '23000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000001',
    'owner'
  ),
  (
    '23000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000002',
    'editor'
  );

insert into public.workspaces (id, team_id, name, created_by)
values
  (
    '33000000-0000-4000-8000-000000000001',
    '23000000-0000-4000-8000-000000000001',
    'Invitation Workspace A',
    '13000000-0000-4000-8000-000000000001'
  ),
  (
    '33000000-0000-4000-8000-000000000002',
    '23000000-0000-4000-8000-000000000001',
    'Invitation Workspace B',
    '13000000-0000-4000-8000-000000000001'
  );

insert into public.workspace_members (workspace_id, user_id, role)
select
  workspace.id,
  member.user_id,
  member.role
from public.workspaces workspace
cross join public.team_members member
where workspace.team_id = '23000000-0000-4000-8000-000000000001'
  and member.team_id = workspace.team_id;

create temporary table invitation_result (
  id uuid,
  team_id uuid,
  role public.workspace_role,
  token text,
  expires_at timestamptz
);
grant select, insert on invitation_result to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '13000000-0000-4000-8000-000000000002',
  true
);

do $$
begin
  begin
    perform public.create_team_invitation(
      '23000000-0000-4000-8000-000000000001',
      'viewer'
    );
    raise exception 'Editor unexpectedly created an invitation';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.list_team_members(
      '23000000-0000-4000-8000-000000000001'
    );
    raise exception 'Editor unexpectedly listed team members';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '13000000-0000-4000-8000-000000000001',
  true
);

insert into invitation_result
select * from public.create_team_invitation(
  '23000000-0000-4000-8000-000000000001',
  'viewer'
);

reset role;

do $$
declare
  v_token text;
  v_hash bytea;
begin
  select token into strict v_token from invitation_result;
  select token_hash into strict v_hash
  from public.team_invitations
  where id = (select id from invitation_result);

  if v_hash <> extensions.digest(v_token, 'sha256')
    or encode(v_hash, 'hex') = v_token
  then
    raise exception 'Invitation token is not stored as a one-way hash';
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '13000000-0000-4000-8000-000000000003',
  true
);

select public.accept_team_invitation(
  (select token from invitation_result)
);

do $$
begin
  begin
    perform public.accept_team_invitation(
      (select token from invitation_result)
    );
    raise exception 'Invitation token was accepted twice';
  exception
    when no_data_found then
      null;
  end;
end;
$$;

reset role;

do $$
begin
  if not exists (
    select 1 from public.team_members
    where team_id = '23000000-0000-4000-8000-000000000001'
      and user_id = '13000000-0000-4000-8000-000000000003'
      and role = 'viewer'
  ) or (
    select count(*) from public.workspace_members
    where user_id = '13000000-0000-4000-8000-000000000003'
      and role = 'viewer'
  ) <> 2 then
    raise exception 'Accepted invitation did not create all memberships';
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '13000000-0000-4000-8000-000000000001',
  true
);

do $$
begin
  if not public.update_team_member_role(
    '23000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000003',
    'editor'
  ) then
    raise exception 'Owner could not update invited member role';
  end if;
  if public.update_team_member_role(
    '23000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000001',
    'viewer'
  ) then
    raise exception 'Owner role was unexpectedly changed';
  end if;
end;
$$;

reset role;

do $$
begin
  if exists (
    select 1 from public.team_members
    where team_id = '23000000-0000-4000-8000-000000000001'
      and user_id = '13000000-0000-4000-8000-000000000003'
      and role <> 'editor'
  ) or (
    select count(*) from public.workspace_members
    where user_id = '13000000-0000-4000-8000-000000000003'
      and role = 'editor'
  ) <> 2 then
    raise exception 'Role update was not propagated to all workspaces';
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '13000000-0000-4000-8000-000000000001',
  true
);

do $$
begin
  if not public.remove_team_member(
    '23000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'Owner could not remove invited member';
  end if;
  if public.remove_team_member(
    '23000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Owner was unexpectedly removed';
  end if;
end;
$$;

reset role;

do $$
begin
  if exists (
    select 1 from public.team_members
    where team_id = '23000000-0000-4000-8000-000000000001'
      and user_id = '13000000-0000-4000-8000-000000000003'
  ) or exists (
    select 1 from public.workspace_members
    where user_id = '13000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'Removed member retained a membership';
  end if;
end;
$$;

create temporary table second_invitation_result (
  id uuid,
  team_id uuid,
  role public.workspace_role,
  token text,
  expires_at timestamptz
);
grant select, insert on second_invitation_result to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '13000000-0000-4000-8000-000000000001',
  true
);

insert into second_invitation_result
select * from public.create_team_invitation(
  '23000000-0000-4000-8000-000000000001',
  'viewer'
);

do $$
begin
  if not exists (
    select 1 from public.list_team_invitations(
      '23000000-0000-4000-8000-000000000001'
    )
    where id = (select id from second_invitation_result)
  ) then
    raise exception 'Owner could not see the pending invitation';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '13000000-0000-4000-8000-000000000002',
  true
);

do $$
begin
  begin
    perform public.list_team_invitations(
      '23000000-0000-4000-8000-000000000001'
    );
    raise exception 'Editor unexpectedly listed pending invitations';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.revoke_team_invitation(
      (select id from second_invitation_result)
    );
    raise exception 'Editor unexpectedly revoked a pending invitation';
  exception
    when insufficient_privilege then
      null;
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
  if not public.revoke_team_invitation(
    (select id from second_invitation_result)
  ) then
    raise exception 'Owner could not revoke the pending invitation';
  end if;
  if public.revoke_team_invitation(
    (select id from second_invitation_result)
  ) then
    raise exception 'Already-revoked invitation was revoked again';
  end if;
  if exists (
    select 1 from public.list_team_invitations(
      '23000000-0000-4000-8000-000000000001'
    )
    where id = (select id from second_invitation_result)
  ) then
    raise exception 'Revoked invitation still appears as pending';
  end if;
end;
$$;

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '13000000-0000-4000-8000-000000000003',
  true
);

do $$
begin
  begin
    perform public.accept_team_invitation(
      (select token from second_invitation_result)
    );
    raise exception 'Revoked invitation token was accepted';
  exception
    when no_data_found then
      null;
  end;
end;
$$;

reset role;

rollback;
