-- Lets team owners see and revoke pending invitations (README/AGENTS follow-up:
-- "belastbarer Einladungs-/Onboarding-Ablauf"). The raw invitation token is
-- never persisted (only its hash), so a revoked invitation cannot be
-- "resent" as the same link - the client re-issues a fresh invitation
-- after revoking the stale one.
alter table public.team_invitations
  add column revoked_at timestamptz,
  add column revoked_by uuid references auth.users(id);

create or replace function public.list_team_invitations(p_team_id uuid)
returns table (
  id uuid,
  team_id uuid,
  role public.workspace_role,
  created_at timestamptz,
  expires_at timestamptz,
  created_by_id uuid,
  created_by_display_name text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.team_members actor
    where actor.team_id = p_team_id
      and actor.user_id = auth.uid()
      and actor.role = 'owner'
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  return query
  select
    invitation.id,
    invitation.team_id,
    invitation.role,
    invitation.created_at,
    invitation.expires_at,
    account.id,
    coalesce(
      nullif(account.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(account.email, '@', 1), ''),
      'Teammitglied'
    )::text
  from public.team_invitations invitation
  join auth.users account on account.id = invitation.created_by
  where invitation.team_id = p_team_id
    and invitation.accepted_at is null
    and invitation.revoked_at is null
    and invitation.expires_at > now()
  order by invitation.created_at desc;
end;
$$;

create or replace function public.revoke_team_invitation(
  p_invitation_id uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'UNAUTHENTICATED';
  end if;

  select team_id into v_team_id
  from public.team_invitations
  where id = p_invitation_id
    and accepted_at is null
    and revoked_at is null
  for update;

  if not found then
    return false;
  end if;

  if not exists (
    select 1
    from public.team_members actor
    where actor.team_id = v_team_id
      and actor.user_id = auth.uid()
      and actor.role = 'owner'
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  update public.team_invitations
  set revoked_at = now(), revoked_by = auth.uid()
  where id = p_invitation_id;

  return true;
end;
$$;

-- A revoked invitation must never be accepted, even if it has not expired.
create or replace function public.accept_team_invitation(
  p_token text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.team_invitations;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'UNAUTHENTICATED';
  end if;

  select * into v_invitation
  from public.team_invitations invitation
  where invitation.token_hash = extensions.digest(p_token, 'sha256')
    and invitation.accepted_at is null
    and invitation.revoked_at is null
    and invitation.expires_at > now()
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'INVITATION_NOT_FOUND';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (v_invitation.team_id, auth.uid(), v_invitation.role)
  on conflict (team_id, user_id) do nothing;

  insert into public.workspace_members (workspace_id, user_id, role)
  select workspace.id, auth.uid(), v_invitation.role
  from public.workspaces workspace
  where workspace.team_id = v_invitation.team_id
  on conflict (workspace_id, user_id) do nothing;

  update public.team_invitations
  set accepted_by = auth.uid(), accepted_at = now()
  where id = v_invitation.id;

  return v_invitation.team_id;
end;
$$;

revoke all on function public.list_team_invitations(uuid) from public, anon;
revoke all on function public.revoke_team_invitation(uuid) from public, anon;
grant execute on function public.list_team_invitations(uuid) to authenticated;
grant execute on function public.revoke_team_invitation(uuid) to authenticated;
