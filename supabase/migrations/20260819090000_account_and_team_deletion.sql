-- README/AGENTS follow-up: team deletion did not exist at all despite the
-- permission table already documenting it for owners, and there was no
-- account-deletion path either. This migration adds both, plus the
-- anonymization needed so a deleted user's shared content survives them
-- (AGENTS.md decision: block self-deletion while sole team owner, anonymize
-- created_by/updated_by/executed_by instead of deleting shared content).

-- 1. created_by/updated_by/executed_by become nullable and SET NULL on the
-- referenced user's deletion, instead of blocking it. Personal-scope data
-- (workspace_members.user_id, team_members.user_id,
-- environment_variables.owner_user_id) already cascades on delete and is
-- intentionally left as-is: personal secrets should disappear with their
-- owner, not be anonymized.
alter table public.teams
  drop constraint teams_created_by_fkey,
  add constraint teams_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null,
  alter column created_by drop not null;

alter table public.workspaces
  drop constraint workspaces_created_by_fkey,
  add constraint workspaces_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null,
  alter column created_by drop not null;

alter table public.collections
  drop constraint collections_created_by_fkey,
  add constraint collections_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null,
  alter column created_by drop not null,
  drop constraint collections_updated_by_fkey,
  add constraint collections_updated_by_fkey
    foreign key (updated_by) references auth.users(id) on delete set null,
  alter column updated_by drop not null;

alter table public.folders
  drop constraint folders_created_by_fkey,
  add constraint folders_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null,
  alter column created_by drop not null,
  drop constraint folders_updated_by_fkey,
  add constraint folders_updated_by_fkey
    foreign key (updated_by) references auth.users(id) on delete set null,
  alter column updated_by drop not null;

alter table public.requests
  drop constraint requests_created_by_fkey,
  add constraint requests_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null,
  alter column created_by drop not null,
  drop constraint requests_updated_by_fkey,
  add constraint requests_updated_by_fkey
    foreign key (updated_by) references auth.users(id) on delete set null,
  alter column updated_by drop not null;

alter table public.request_revisions
  drop constraint request_revisions_created_by_fkey,
  add constraint request_revisions_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null,
  alter column created_by drop not null;

alter table public.environments
  drop constraint environments_created_by_fkey,
  add constraint environments_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null,
  alter column created_by drop not null,
  drop constraint environments_updated_by_fkey,
  add constraint environments_updated_by_fkey
    foreign key (updated_by) references auth.users(id) on delete set null,
  alter column updated_by drop not null;

alter table public.environment_variables
  drop constraint environment_variables_created_by_fkey,
  add constraint environment_variables_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null,
  alter column created_by drop not null,
  drop constraint environment_variables_updated_by_fkey,
  add constraint environment_variables_updated_by_fkey
    foreign key (updated_by) references auth.users(id) on delete set null,
  alter column updated_by drop not null;

alter table public.request_executions
  drop constraint request_executions_executed_by_fkey,
  add constraint request_executions_executed_by_fkey
    foreign key (executed_by) references auth.users(id) on delete set null,
  alter column executed_by drop not null;

alter table public.team_invitations
  drop constraint team_invitations_created_by_fkey,
  add constraint team_invitations_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null,
  alter column created_by drop not null;

-- 2. Listing functions that displayed a creator/executor name must not
-- silently drop rows once that column can be null (an inner join would
-- exclude them); switch to a left join with an explicit placeholder.
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
      'Gelöschter Nutzer'
    )::text
  from public.team_invitations invitation
  left join auth.users account on account.id = invitation.created_by
  where invitation.team_id = p_team_id
    and invitation.accepted_at is null
    and invitation.revoked_at is null
    and invitation.expires_at > now()
  order by invitation.created_at desc;
end;
$$;

create or replace function public.list_request_executions(p_workspace_id uuid)
returns table (
  id uuid,
  request_id uuid,
  request_name text,
  method text,
  status_code integer,
  duration_ms integer,
  successful boolean,
  executed_by uuid,
  executed_by_name text,
  executed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.workspace_members member
    where member.workspace_id = p_workspace_id
      and member.user_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  return query
  select
    execution.id,
    execution.request_id,
    request.name,
    execution.method,
    execution.status_code,
    execution.duration_ms,
    execution.successful,
    execution.executed_by,
    coalesce(
      nullif(account.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(account.email, '@', 1), ''),
      'Gelöschter Nutzer'
    )::text,
    execution.executed_at
  from public.request_executions execution
  join public.requests request on request.id = execution.request_id
  left join auth.users account on account.id = execution.executed_by
  where execution.workspace_id = p_workspace_id
    and execution.executed_at >= now() - interval '30 days'
  order by execution.executed_at desc, execution.id desc
  limit 100;
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
      'Gelöschter Nutzer'
    )::text,
    revision.created_at
  from public.request_revisions revision
  left join auth.users account on account.id = revision.created_by
  where revision.request_id = p_request_id
  order by revision.version desc
  limit 100;
end;
$$;

-- 3. Team deletion (owner-only; cascades already remove every workspace,
-- collection, folder, request, revision, execution, environment, variable,
-- membership, and invitation beneath it via existing FKs).
create or replace function public.delete_team(p_team_id uuid)
returns boolean
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

  delete from public.teams where id = p_team_id;
  return found;
end;
$$;

-- 4. Pre-check for self-account deletion: teams where the caller is the
-- only owner must be handed off or deleted first (AGENTS.md decision -
-- deletion is blocked rather than silently orphaning or cascading through
-- other members' data).
create or replace function public.list_sole_owner_teams()
returns table (id uuid, name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'UNAUTHENTICATED';
  end if;

  return query
  select team.id, team.name
  from public.teams team
  where exists (
    select 1
    from public.team_members owned
    where owned.team_id = team.id
      and owned.user_id = auth.uid()
      and owned.role = 'owner'
  )
  and (
    select count(*)
    from public.team_members other_owner
    where other_owner.team_id = team.id
      and other_owner.role = 'owner'
  ) = 1;
end;
$$;

revoke all on function public.delete_team(uuid) from public, anon;
revoke all on function public.list_sole_owner_teams() from public, anon;
grant execute on function public.delete_team(uuid) to authenticated;
grant execute on function public.list_sole_owner_teams() to authenticated;
