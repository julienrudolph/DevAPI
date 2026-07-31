\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('12000000-0000-4000-8000-000000000001', 'editor.navigation@local.test'),
  ('12000000-0000-4000-8000-000000000002', 'viewer.navigation@local.test');

insert into public.teams (id, name, created_by)
values (
  '22000000-0000-4000-8000-000000000001',
  'Navigation Integration Team',
  '12000000-0000-4000-8000-000000000001'
);

insert into public.workspaces (id, team_id, name, created_by)
values (
  '32000000-0000-4000-8000-000000000001',
  '22000000-0000-4000-8000-000000000001',
  'Navigation Integration Workspace',
  '12000000-0000-4000-8000-000000000001'
);

insert into public.workspace_members (workspace_id, user_id, role)
values
  (
    '32000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001',
    'editor'
  ),
  (
    '32000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000002',
    'viewer'
  );

insert into public.collections (
  id, workspace_id, name, created_by, updated_by
) values
  (
    '42000000-0000-4000-8000-000000000001',
    '32000000-0000-4000-8000-000000000001',
    'Empty collection',
    '12000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001'
  ),
  (
    '42000000-0000-4000-8000-000000000002',
    '32000000-0000-4000-8000-000000000001',
    'Non-empty collection',
    '12000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001'
  );

insert into public.folders (
  id, workspace_id, collection_id, name, created_by, updated_by
) values
  (
    '52000000-0000-4000-8000-000000000001',
    '32000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000002',
    'Empty folder',
    '12000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001'
  ),
  (
    '52000000-0000-4000-8000-000000000002',
    '32000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000002',
    'Non-empty folder',
    '12000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001'
  );

insert into public.requests (
  id, workspace_id, collection_id, folder_id, name, method, url,
  created_by, updated_by
) values (
  '62000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001',
  '42000000-0000-4000-8000-000000000002',
  '52000000-0000-4000-8000-000000000002',
  'Contained request',
  'GET',
  'https://example.test',
  '12000000-0000-4000-8000-000000000001',
  '12000000-0000-4000-8000-000000000001'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '12000000-0000-4000-8000-000000000002',
  true
);

do $$
begin
  begin
    perform public.delete_empty_collection(
      '42000000-0000-4000-8000-000000000001',
      1
    );
    raise exception 'Viewer unexpectedly deleted a collection';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '12000000-0000-4000-8000-000000000001',
  true
);

do $$
begin
  begin
    perform public.delete_empty_collection(
      '42000000-0000-4000-8000-000000000001',
      2
    );
    raise exception 'Stale collection version was accepted';
  exception
    when serialization_failure then null;
  end;

  begin
    perform public.delete_empty_collection(
      '42000000-0000-4000-8000-000000000002',
      1
    );
    raise exception 'Non-empty collection was deleted';
  exception
    when raise_exception then
      if sqlerrm <> 'COLLECTION_NOT_EMPTY' then raise; end if;
  end;

  begin
    perform public.delete_empty_folder(
      '52000000-0000-4000-8000-000000000002',
      1
    );
    raise exception 'Non-empty folder was deleted';
  exception
    when raise_exception then
      if sqlerrm <> 'FOLDER_NOT_EMPTY' then raise; end if;
  end;
end;
$$;

select public.delete_empty_folder(
  '52000000-0000-4000-8000-000000000001',
  1
);
select public.delete_empty_collection(
  '42000000-0000-4000-8000-000000000001',
  1
);

reset role;

do $$
begin
  if exists (
    select 1 from public.folders
    where id = '52000000-0000-4000-8000-000000000001'
  ) or exists (
    select 1 from public.collections
    where id = '42000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Empty navigation items were not deleted';
  end if;

  if not exists (
    select 1 from public.requests
    where id = '62000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Contained request was deleted unexpectedly';
  end if;
end;
$$;

rollback;
