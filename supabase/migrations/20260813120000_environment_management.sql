create policy "editors can update environments"
on public.environments for update
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = environments.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'editor')
  )
)
with check (
  updated_by = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = environments.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'editor')
  )
);

create policy "editors can delete environments"
on public.environments for delete
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = environments.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'editor')
  )
);

create policy "members can delete permitted environment variables"
on public.environment_variables for delete
using (
  exists (
    select 1
    from public.environments e
    join public.workspace_members wm on wm.workspace_id = e.workspace_id
    where e.id = environment_variables.environment_id
      and wm.user_id = auth.uid()
      and (
        (scope = 'personal' and owner_user_id = auth.uid())
        or (scope = 'shared' and wm.role in ('owner', 'editor'))
      )
  )
);

grant update, delete on public.environments to authenticated;
grant delete on public.environment_variables to authenticated;
