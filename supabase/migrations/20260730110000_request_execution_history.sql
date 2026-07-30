create table public.request_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  request_id uuid not null references public.requests(id) on delete cascade,
  method text not null check (method in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  status_code integer not null check (status_code between 100 and 599),
  duration_ms integer not null check (duration_ms >= 0),
  successful boolean not null,
  executed_by uuid not null references auth.users(id),
  executed_at timestamptz not null default now()
);

create index request_executions_workspace_time_idx
on public.request_executions (workspace_id, executed_at desc);

alter table public.request_executions enable row level security;

create policy "workspace members can read request execution history"
on public.request_executions for select
using (
  exists (
    select 1
    from public.workspace_members member
    where member.workspace_id = request_executions.workspace_id
      and member.user_id = auth.uid()
  )
);

grant select on public.request_executions to authenticated;

create or replace function public.record_request_execution(
  p_request_id uuid,
  p_method text,
  p_status_code integer,
  p_duration_ms integer,
  p_successful boolean
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_execution_id uuid;
  v_workspace_id uuid;
begin
  select request.workspace_id into v_workspace_id
  from public.requests request
  join public.workspace_members member
    on member.workspace_id = request.workspace_id
  where request.id = p_request_id
    and member.user_id = auth.uid();

  if not found then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  insert into public.request_executions (
    workspace_id,
    request_id,
    method,
    status_code,
    duration_ms,
    successful,
    executed_by
  ) values (
    v_workspace_id,
    p_request_id,
    p_method,
    p_status_code,
    p_duration_ms,
    p_successful,
    auth.uid()
  )
  returning id into v_execution_id;

  delete from public.request_executions execution
  where execution.workspace_id = v_workspace_id
    and (
      execution.executed_at < now() - interval '30 days'
      or execution.id in (
        select old_execution.id
        from public.request_executions old_execution
        where old_execution.workspace_id = v_workspace_id
        order by old_execution.executed_at desc, old_execution.id desc
        offset 100
      )
    );

  return v_execution_id;
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
      'Teammitglied'
    )::text,
    execution.executed_at
  from public.request_executions execution
  join public.requests request on request.id = execution.request_id
  join auth.users account on account.id = execution.executed_by
  where execution.workspace_id = p_workspace_id
    and execution.executed_at >= now() - interval '30 days'
  order by execution.executed_at desc, execution.id desc
  limit 100;
end;
$$;

revoke all on function public.record_request_execution(
  uuid,
  text,
  integer,
  integer,
  boolean
) from public, anon;
revoke all on function public.list_request_executions(uuid) from public, anon;
grant execute on function public.record_request_execution(
  uuid,
  text,
  integer,
  integer,
  boolean
) to authenticated;
grant execute on function public.list_request_executions(uuid) to authenticated;
