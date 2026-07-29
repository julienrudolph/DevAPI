create table public.environments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table public.environment_variables (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.environments(id) on delete cascade,
  key text not null check (
    char_length(key) between 1 and 160
    and key ~ '^[A-Za-z_][A-Za-z0-9_.-]*$'
  ),
  value text not null check (char_length(value) <= 32768),
  scope text not null check (scope in ('shared', 'personal')),
  owner_user_id uuid references auth.users(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'shared' and owner_user_id is null)
    or (scope = 'personal' and owner_user_id is not null)
  )
);

create unique index environment_variables_shared_key
on public.environment_variables (environment_id, key)
where owner_user_id is null;

create unique index environment_variables_personal_key
on public.environment_variables (environment_id, key, owner_user_id)
where owner_user_id is not null;

alter table public.environments enable row level security;
alter table public.environment_variables enable row level security;

create policy "workspace members can read environments"
on public.environments for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = environments.workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy "editors can create environments"
on public.environments for insert
with check (
  created_by = auth.uid()
  and updated_by = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = environments.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'editor')
  )
);

create policy "members can read visible environment variables"
on public.environment_variables for select
using (
  (scope = 'shared' or owner_user_id = auth.uid())
  and exists (
    select 1
    from public.environments e
    join public.workspace_members wm on wm.workspace_id = e.workspace_id
    where e.id = environment_variables.environment_id
      and wm.user_id = auth.uid()
  )
);

create policy "members can create permitted environment variables"
on public.environment_variables for insert
with check (
  created_by = auth.uid()
  and updated_by = auth.uid()
  and exists (
    select 1
    from public.environments e
    join public.workspace_members wm on wm.workspace_id = e.workspace_id
    where e.id = environment_variables.environment_id
      and wm.user_id = auth.uid()
  )
  and (
    (scope = 'personal' and owner_user_id = auth.uid())
    or (
      scope = 'shared'
      and owner_user_id is null
      and exists (
        select 1
        from public.environments e
        join public.workspace_members wm on wm.workspace_id = e.workspace_id
        where e.id = environment_variables.environment_id
          and wm.user_id = auth.uid()
          and wm.role in ('owner', 'editor')
      )
    )
  )
);

create policy "members can update permitted environment variables"
on public.environment_variables for update
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
)
with check (
  updated_by = auth.uid()
  and exists (
    select 1
    from public.environments e
    join public.workspace_members wm on wm.workspace_id = e.workspace_id
    where e.id = environment_variables.environment_id
      and wm.user_id = auth.uid()
  )
  and (
    (scope = 'personal' and owner_user_id = auth.uid())
    or (
      scope = 'shared'
      and owner_user_id is null
      and exists (
        select 1
        from public.environments e
        join public.workspace_members wm on wm.workspace_id = e.workspace_id
        where e.id = environment_variables.environment_id
          and wm.user_id = auth.uid()
          and wm.role in ('owner', 'editor')
      )
    )
  )
);

grant select, insert on public.environments to authenticated;
grant select, insert, update on public.environment_variables to authenticated;
