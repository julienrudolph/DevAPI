alter table public.collections
  add column version integer not null default 1 check (version > 0);

create policy "editors can create collections"
on public.collections for insert
with check (
  created_by = auth.uid()
  and updated_by = auth.uid()
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = collections.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'editor')
  )
);

create or replace function public.create_team_workspace(
  p_team_name text,
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
  v_team_id uuid;
  v_workspace_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  p_team_name := nullif(btrim(p_team_name), '');
  p_workspace_name := nullif(btrim(p_workspace_name), '');
  if p_team_name is null or char_length(p_team_name) > 160
    or p_workspace_name is null or char_length(p_workspace_name) > 160
  then
    raise exception using errcode = '22023', message = 'INVALID_WORKSPACE_INPUT';
  end if;

  insert into public.teams (name, created_by)
  values (p_team_name, v_user_id)
  returning teams.id into v_team_id;

  insert into public.team_members (team_id, user_id, role)
  values (v_team_id, v_user_id, 'owner');

  insert into public.workspaces (team_id, name, created_by)
  values (v_team_id, p_workspace_name, v_user_id)
  returning workspaces.id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, 'owner');

  return query
  select v_workspace_id, v_team_id, p_workspace_name, 'owner'::public.workspace_role;
end;
$$;

revoke all on function public.create_team_workspace(text, text) from public;
revoke all on function public.create_team_workspace(text, text) from anon;
grant execute on function public.create_team_workspace(text, text)
to authenticated;
