\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('14000000-0000-4000-8000-000000000001', 'editor.revision@local.test'),
  ('14000000-0000-4000-8000-000000000002', 'viewer.revision@local.test'),
  ('14000000-0000-4000-8000-000000000003', 'outsider.revision@local.test');

insert into public.teams (id, name, created_by)
values (
  '24000000-0000-4000-8000-000000000001',
  'Revision Integration Team',
  '14000000-0000-4000-8000-000000000001'
);

insert into public.workspaces (id, team_id, name, created_by)
values (
  '34000000-0000-4000-8000-000000000001',
  '24000000-0000-4000-8000-000000000001',
  'Revision Integration Workspace',
  '14000000-0000-4000-8000-000000000001'
);

insert into public.workspace_members (workspace_id, user_id, role)
values
  (
    '34000000-0000-4000-8000-000000000001',
    '14000000-0000-4000-8000-000000000001',
    'editor'
  ),
  (
    '34000000-0000-4000-8000-000000000001',
    '14000000-0000-4000-8000-000000000002',
    'viewer'
  );

insert into public.collections (
  id, workspace_id, name, created_by, updated_by
) values (
  '44000000-0000-4000-8000-000000000001',
  '34000000-0000-4000-8000-000000000001',
  'Revision Collection',
  '14000000-0000-4000-8000-000000000001',
  '14000000-0000-4000-8000-000000000001'
);

insert into public.requests (
  id, workspace_id, collection_id, name, method, url, headers,
  created_by, updated_by
) values (
  '54000000-0000-4000-8000-000000000001',
  '34000000-0000-4000-8000-000000000001',
  '44000000-0000-4000-8000-000000000001',
  'Original request',
  'GET',
  'https://example.test/original',
  '[{"id":"64000000-0000-4000-8000-000000000001","key":"Authorization","value":"Bearer secret","enabled":true}]',
  '14000000-0000-4000-8000-000000000001',
  '14000000-0000-4000-8000-000000000001'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '14000000-0000-4000-8000-000000000001',
  true
);

do $$
begin
  begin
    perform public.update_request_with_revision(
      '54000000-0000-4000-8000-000000000001',
      2,
      '{"name":"Stale","method":"GET","url":"https://example.test/stale","queryParams":[],"headers":[],"body":{"type":"none"},"collectionId":"44000000-0000-4000-8000-000000000001","folderId":null}',
      'update'
    );
    raise exception 'Stale request version was accepted';
  exception
    when raise_exception then
      if sqlerrm <> 'REQUEST_VERSION_CONFLICT' then
        raise;
      end if;
  end;
end;
$$;

select public.update_request_with_revision(
  '54000000-0000-4000-8000-000000000001',
  1,
  '{"name":"Updated request","method":"POST","url":"https://example.test/updated","queryParams":[],"headers":[{"id":"64000000-0000-4000-8000-000000000002","key":"X-Token","value":"new-secret","enabled":true}],"body":{"type":"json","content":"{}"},"collectionId":"44000000-0000-4000-8000-000000000001","folderId":null}',
  'update'
);

reset role;

do $$
declare
  v_revision_id uuid;
begin
  if (select version from public.requests
      where id = '54000000-0000-4000-8000-000000000001') <> 2
  then
    raise exception 'Successful update did not increment request version';
  end if;
  if (select count(*) from public.request_revisions
      where request_id = '54000000-0000-4000-8000-000000000001') <> 1
  then
    raise exception 'Update did not create exactly one revision';
  end if;

  select id into strict v_revision_id
  from public.request_revisions
  where request_id = '54000000-0000-4000-8000-000000000001'
    and version = 1;

  if (
    select snapshot #>> '{headers,0,value}'
    from public.request_revisions
    where id = v_revision_id
  ) <> '' then
    raise exception 'Revision contains a header secret';
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '14000000-0000-4000-8000-000000000002',
  true
);

do $$
begin
  if (select count(*) from public.list_request_revisions(
    '54000000-0000-4000-8000-000000000001'
  )) <> 1 then
    raise exception 'Viewer cannot read request revisions';
  end if;

  begin
    perform public.update_request_with_revision(
      '54000000-0000-4000-8000-000000000001',
      2,
      '{"name":"Viewer update","method":"GET","url":"https://example.test","queryParams":[],"headers":[],"body":{"type":"none"},"collectionId":"44000000-0000-4000-8000-000000000001","folderId":null}',
      'update'
    );
    raise exception 'Viewer unexpectedly updated a request';
  exception
    when no_data_found then
      null;
  end;

  perform public.record_request_execution(
    '54000000-0000-4000-8000-000000000001',
    'POST',
    201,
    125,
    true
  );

  if (select count(*) from public.list_request_executions(
    '34000000-0000-4000-8000-000000000001'
  )) <> 1 then
    raise exception 'Viewer cannot read recorded execution history';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '14000000-0000-4000-8000-000000000003',
  true
);

do $$
begin
  if exists (
    select 1 from public.requests
    where id = '54000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Outsider can read request';
  end if;

  begin
    perform public.list_request_revisions(
      '54000000-0000-4000-8000-000000000001'
    );
    raise exception 'Outsider unexpectedly listed revisions';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.record_request_execution(
      '54000000-0000-4000-8000-000000000001',
      'GET',
      200,
      1,
      true
    );
    raise exception 'Outsider unexpectedly recorded an execution';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

reset role;

create temporary table revision_to_restore as
select id
from public.request_revisions
where request_id = '54000000-0000-4000-8000-000000000001'
  and version = 1;
grant select on revision_to_restore to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '14000000-0000-4000-8000-000000000001',
  true
);

select public.restore_request_revision(
  '54000000-0000-4000-8000-000000000001',
  (select id from revision_to_restore),
  2
);

reset role;

do $$
begin
  if not exists (
    select 1 from public.requests
    where id = '54000000-0000-4000-8000-000000000001'
      and name = 'Original request'
      and version = 3
  ) then
    raise exception 'Revision restore did not create the expected version';
  end if;
  if not exists (
    select 1 from public.request_revisions
    where request_id = '54000000-0000-4000-8000-000000000001'
      and version = 2
      and change_type = 'restore'
      and snapshot #>> '{headers,0,value}' = ''
  ) then
    raise exception 'Restore did not preserve a sanitized revision';
  end if;
end;
$$;

delete from public.workspace_members
where workspace_id = '34000000-0000-4000-8000-000000000001'
  and user_id = '14000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '14000000-0000-4000-8000-000000000002',
  true
);

do $$
begin
  begin
    perform public.list_request_executions(
      '34000000-0000-4000-8000-000000000001'
    );
    raise exception 'Revoked member unexpectedly listed execution history';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

rollback;
