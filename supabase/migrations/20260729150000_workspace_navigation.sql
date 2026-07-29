create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

alter table public.workspaces
  add constraint workspaces_team_id_fkey
  foreign key (team_id) references public.teams(id) on delete cascade not valid;

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  position integer not null default 0 check (position >= 0),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  parent_folder_id uuid references public.folders(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  position integer not null default 0 check (position >= 0),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.requests
  add constraint requests_collection_id_fkey
  foreign key (collection_id) references public.collections(id)
  on delete set null not valid;

alter table public.requests
  add constraint requests_folder_id_fkey
  foreign key (folder_id) references public.folders(id)
  on delete set null not valid;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.collections enable row level security;
alter table public.folders enable row level security;

create policy "members can read their teams"
on public.teams for select
using (
  exists (
    select 1 from public.team_members tm
    where tm.team_id = teams.id and tm.user_id = auth.uid()
  )
);

create policy "members can read their team membership"
on public.team_members for select
using (user_id = auth.uid());

create policy "workspace members can read collections"
on public.collections for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = collections.workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy "workspace members can read folders"
on public.folders for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = folders.workspace_id
      and wm.user_id = auth.uid()
  )
);

grant select on public.teams to authenticated;
grant select on public.team_members to authenticated;
grant select, insert, update, delete on public.collections to authenticated;
grant select, insert, update, delete on public.folders to authenticated;
