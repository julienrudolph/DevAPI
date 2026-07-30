create or replace function public.list_team_members(p_team_id uuid)
returns table (
  user_id uuid,
  email text,
  display_name text,
  role public.workspace_role,
  joined_at timestamptz
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
    member.user_id,
    account.email::text,
    coalesce(
      nullif(account.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(account.email, '@', 1), ''),
      'Teammitglied'
    )::text,
    member.role,
    member.created_at
  from public.team_members member
  join auth.users account on account.id = member.user_id
  where member.team_id = p_team_id
  order by
    case when member.role = 'owner' then 0 else 1 end,
    account.email;
end;
$$;

create or replace function public.update_team_member_role(
  p_team_id uuid,
  p_user_id uuid,
  p_role public.workspace_role
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_role not in ('editor', 'viewer') then
    raise exception using errcode = '22023', message = 'INVALID_MEMBER_ROLE';
  end if;
  if not exists (
    select 1
    from public.team_members actor
    where actor.team_id = p_team_id
      and actor.user_id = auth.uid()
      and actor.role = 'owner'
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  update public.team_members member
  set role = p_role
  where member.team_id = p_team_id
    and member.user_id = p_user_id
    and member.role <> 'owner';

  if not found then
    return false;
  end if;

  update public.workspace_members member
  set role = p_role
  from public.workspaces workspace
  where workspace.id = member.workspace_id
    and workspace.team_id = p_team_id
    and member.user_id = p_user_id;

  return true;
end;
$$;

create or replace function public.remove_team_member(
  p_team_id uuid,
  p_user_id uuid
) returns boolean
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

  delete from public.team_members member
  where member.team_id = p_team_id
    and member.user_id = p_user_id
    and member.role <> 'owner';

  if not found then
    return false;
  end if;

  delete from public.workspace_members member
  using public.workspaces workspace
  where workspace.id = member.workspace_id
    and workspace.team_id = p_team_id
    and member.user_id = p_user_id;

  return true;
end;
$$;

revoke all on function public.list_team_members(uuid) from public, anon;
revoke all on function public.update_team_member_role(
  uuid,
  uuid,
  public.workspace_role
) from public, anon;
revoke all on function public.remove_team_member(uuid, uuid) from public, anon;

grant execute on function public.list_team_members(uuid) to authenticated;
grant execute on function public.update_team_member_role(
  uuid,
  uuid,
  public.workspace_role
) to authenticated;
grant execute on function public.remove_team_member(uuid, uuid) to authenticated;
