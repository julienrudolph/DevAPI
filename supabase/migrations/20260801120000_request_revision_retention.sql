create index if not exists request_revisions_request_created_idx
on public.request_revisions (request_id, created_at desc, id desc);

create or replace function private.prune_request_revision_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1
  from public.requests
  where id = new.request_id
  for update;

  delete from public.request_revisions revision
  where revision.request_id = new.request_id
    and revision.created_at < statement_timestamp() - interval '180 days';

  delete from public.request_revisions revision
  where revision.id in (
    select old_revision.id
    from public.request_revisions old_revision
    where old_revision.request_id = new.request_id
    order by old_revision.version desc, old_revision.id desc
    offset 100
  );

  return new;
end;
$$;

revoke all on function private.prune_request_revision_history()
from public, anon, authenticated;

drop trigger if exists prune_request_revision_history
on public.request_revisions;

create trigger prune_request_revision_history
after insert on public.request_revisions
for each row execute function private.prune_request_revision_history();
