#!/bin/sh
set -eu

psql -v ON_ERROR_STOP=1 <<'SQL'
create schema if not exists app_migrations;
create table if not exists app_migrations.applied (
  version text primary key,
  applied_at timestamptz not null default now()
);
SQL

for migration in /migrations/*.sql; do
  version="$(basename "$migration" .sql)"
  applied="$(
    psql -v ON_ERROR_STOP=1 -v version="$version" -Atq <<'SQL'
select 1
from app_migrations.applied
where version = :'version';
SQL
  )"
  if [ "$applied" = "1" ]; then
    echo "Migration bereits angewendet: $version"
    continue
  fi

  echo "Wende Migration an: $version"
  psql -v ON_ERROR_STOP=1 -f "$migration"
  psql -v ON_ERROR_STOP=1 -v version="$version" <<'SQL'
insert into app_migrations.applied(version)
values (:'version');
SQL
done
