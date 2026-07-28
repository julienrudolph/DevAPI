create extension if not exists pgcrypto;

create type public.workspace_role as enum ('owner', 'editor', 'viewer');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  name text not null check (char_length(name) between 1 and 160),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  collection_id uuid,
  folder_id uuid,
  name text not null check (char_length(name) between 1 and 160),
  method text not null check (method in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  url text not null check (char_length(url) between 1 and 8192),
  query_params jsonb not null default '[]'::jsonb,
  headers jsonb not null default '[]'::jsonb,
  body jsonb not null default '{"type":"none"}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.request_revisions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  change_type text not null check (change_type in ('update', 'overwrite')),
  unique (request_id, version)
);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.requests enable row level security;
alter table public.request_revisions enable row level security;

create policy "members can read their membership"
on public.workspace_members for select
using (user_id = auth.uid());

create policy "members can read workspaces"
on public.workspaces for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = auth.uid()
  )
);

create policy "members can read requests"
on public.requests for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = requests.workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy "editors can update requests"
on public.requests for update
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = requests.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'editor')
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = requests.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'editor')
  )
);

create policy "members can read revisions"
on public.request_revisions for select
using (
  exists (
    select 1
    from public.requests r
    join public.workspace_members wm on wm.workspace_id = r.workspace_id
    where r.id = request_revisions.request_id
      and wm.user_id = auth.uid()
  )
);

create policy "editors can create revisions"
on public.request_revisions for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.requests r
    join public.workspace_members wm on wm.workspace_id = r.workspace_id
    where r.id = request_revisions.request_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'editor')
  )
);

create or replace function public.update_request_with_revision(
  p_request_id uuid,
  p_expected_version integer,
  p_draft jsonb,
  p_change_type text default 'update'
) returns public.requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current public.requests;
  v_updated public.requests;
begin
  select * into v_current
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'REQUEST_NOT_FOUND';
  end if;
  if v_current.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'REQUEST_VERSION_CONFLICT';
  end if;

  insert into public.request_revisions (
    request_id, version, snapshot, created_by, change_type
  ) values (
    v_current.id,
    v_current.version,
    to_jsonb(v_current),
    auth.uid(),
    p_change_type
  );

  update public.requests
  set
    name = p_draft->>'name',
    method = p_draft->>'method',
    url = p_draft->>'url',
    query_params = p_draft->'queryParams',
    headers = p_draft->'headers',
    body = p_draft->'body',
    version = version + 1,
    updated_by = auth.uid(),
    updated_at = now()
  where id = p_request_id and version = p_expected_version
  returning * into v_updated;

  if not found then
    raise exception using errcode = '40001', message = 'REQUEST_VERSION_CONFLICT';
  end if;
  return v_updated;
end;
$$;
