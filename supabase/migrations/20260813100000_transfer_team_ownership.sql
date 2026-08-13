create or replace function public.transfer_team_ownership(
  p_team_id uuid,
  p_new_owner_user_id uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if p_new_owner_user_id = v_actor_id then
    raise exception using errcode = '22023', message = 'CANNOT_TRANSFER_TO_SELF';
  end if;
  if not exists (
    select 1
    from public.team_members actor
    where actor.team_id = p_team_id
      and actor.user_id = v_actor_id
      and actor.role = 'owner'
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  update public.team_members member
  set role = 'owner'
  where member.team_id = p_team_id
    and member.user_id = p_new_owner_user_id
    and member.role <> 'owner';

  if not found then
    return false;
  end if;

  update public.team_members member
  set role = 'editor'
  where member.team_id = p_team_id
    and member.user_id = v_actor_id;

  update public.workspace_members member
  set role = 'owner'
  from public.workspaces workspace
  where workspace.id = member.workspace_id
    and workspace.team_id = p_team_id
    and member.user_id = p_new_owner_user_id;

  update public.workspace_members member
  set role = 'editor'
  from public.workspaces workspace
  where workspace.id = member.workspace_id
    and workspace.team_id = p_team_id
    and member.user_id = v_actor_id;

  return true;
end;
$$;

revoke all on function public.transfer_team_ownership(uuid, uuid)
from public, anon;
grant execute on function public.transfer_team_ownership(uuid, uuid)
to authenticated;
