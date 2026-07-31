create or replace function public.create_workspace_in_team(
  p_team_id uuid,
  p_workspace_name text
) returns table (
  id uuid,
  team_id uuid,
  name text,
  role public.workspace_role
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;

  p_workspace_name := nullif(btrim(p_workspace_name), '');
  if p_workspace_name is null or char_length(p_workspace_name) > 160 then
    raise exception using errcode = '22023', message = 'INVALID_WORKSPACE_INPUT';
  end if;

  if not exists (
    select 1
    from public.team_members member
    where member.team_id = p_team_id
      and member.user_id = v_user_id
      and member.role = 'owner'
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  insert into public.workspaces (team_id, name, created_by)
  values (p_team_id, p_workspace_name, v_user_id)
  returning workspaces.id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  select v_workspace_id, member.user_id, member.role
  from public.team_members member
  where member.team_id = p_team_id;

  return query
  select
    v_workspace_id,
    p_team_id,
    p_workspace_name,
    'owner'::public.workspace_role;
end;
$$;

revoke all on function public.create_workspace_in_team(uuid, text)
from public, anon;
grant execute on function public.create_workspace_in_team(uuid, text)
to authenticated;
