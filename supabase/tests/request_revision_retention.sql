\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values (
  '16000000-0000-4000-8000-000000000001',
  'revision.retention@local.test'
);

insert into public.teams (id, name, created_by)
values (
  '26000000-0000-4000-8000-000000000001',
  'Revision Retention Team',
  '16000000-0000-4000-8000-000000000001'
);

insert into public.workspaces (id, team_id, name, created_by)
values (
  '36000000-0000-4000-8000-000000000001',
  '26000000-0000-4000-8000-000000000001',
  'Revision Retention Workspace',
  '16000000-0000-4000-8000-000000000001'
);

insert into public.requests (
  id, workspace_id, name, method, url, created_by, updated_by
) values (
  '56000000-0000-4000-8000-000000000001',
  '36000000-0000-4000-8000-000000000001',
  'Retention request',
  'GET',
  'https://example.test/retention',
  '16000000-0000-4000-8000-000000000001',
  '16000000-0000-4000-8000-000000000001'
);

insert into public.request_revisions (
  request_id, version, snapshot, created_by, change_type
)
select
  '56000000-0000-4000-8000-000000000001',
  version,
  jsonb_build_object(
    'name', 'Version ' || version,
    'method', 'GET',
    'url', 'https://example.test/retention',
    'query_params', '[]'::jsonb,
    'headers', '[]'::jsonb,
    'body', '{"type":"none"}'::jsonb
  ),
  '16000000-0000-4000-8000-000000000001',
  'update'
from generate_series(1, 105) version;

do $$
begin
  if (
    select count(*)
    from public.request_revisions
    where request_id = '56000000-0000-4000-8000-000000000001'
  ) <> 100 then
    raise exception 'Revision count retention was not enforced';
  end if;

  if (
    select min(version)
    from public.request_revisions
    where request_id = '56000000-0000-4000-8000-000000000001'
  ) <> 6 then
    raise exception 'Oldest surplus revisions were not removed';
  end if;
end;
$$;

insert into public.request_revisions (
  request_id,
  version,
  snapshot,
  created_by,
  created_at,
  change_type
) values (
  '56000000-0000-4000-8000-000000000001',
  106,
  '{"name":"Expired","method":"GET","url":"https://example.test/retention","query_params":[],"headers":[],"body":{"type":"none"}}',
  '16000000-0000-4000-8000-000000000001',
  now() - interval '181 days',
  'update'
);

do $$
begin
  if exists (
    select 1
    from public.request_revisions
    where request_id = '56000000-0000-4000-8000-000000000001'
      and version = 106
  ) then
    raise exception 'Expired revision was retained';
  end if;
end;
$$;

rollback;
