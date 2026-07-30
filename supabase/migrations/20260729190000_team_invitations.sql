create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  token_hash bytea not null unique,
  role public.workspace_role not null check (role in ('editor', 'viewer')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  check (
    (accepted_by is null and accepted_at is null)
    or (accepted_by is not null and accepted_at is not null)
  )
);

alter table public.team_invitations enable row level security;

create policy "owners can read team invitation metadata"
on public.team_invitations for select
using (
  exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_invitations.team_id
      and tm.user_id = auth.uid()
      and tm.role = 'owner'
  )
);

create or replace function public.create_team_invitation(
  p_team_id uuid,
  p_role public.workspace_role
) returns table (
  id uuid,
  team_id uuid,
  role public.workspace_role,
  token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'UNAUTHENTICATED';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception using errcode = '22023', message = 'INVALID_INVITATION_ROLE';
  end if;
  if not exists (
    select 1
    from public.team_members tm
    where tm.team_id = p_team_id
      and tm.user_id = auth.uid()
      and tm.role = 'owner'
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  v_token := encode(public.gen_random_bytes(32), 'hex');
  return query
  insert into public.team_invitations as invitation (
    team_id,
    token_hash,
    role,
    created_by,
    expires_at
  ) values (
    p_team_id,
    public.digest(v_token, 'sha256'),
    p_role,
    auth.uid(),
    now() + interval '7 days'
  )
  returning
    invitation.id,
    invitation.team_id,
    invitation.role,
    v_token,
    invitation.expires_at;
end;
$$;

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
  where invitation.token_hash = public.digest(p_token, 'sha256')
    and invitation.accepted_at is null
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

revoke all on function public.create_team_invitation(uuid, public.workspace_role)
from public, anon;
revoke all on function public.accept_team_invitation(text)
from public, anon;
grant execute on function public.create_team_invitation(uuid, public.workspace_role)
to authenticated;
grant execute on function public.accept_team_invitation(text)
to authenticated;
