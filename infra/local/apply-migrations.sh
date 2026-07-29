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
  applied="$(psql -v ON_ERROR_STOP=1 -v version="$version" -Atqc \
    "select 1 from app_migrations.applied where version = :'version'")"
  if [ "$applied" = "1" ]; then
    echo "Migration bereits angewendet: $version"
    continue
  fi

  echo "Wende Migration an: $version"
  psql -v ON_ERROR_STOP=1 -f "$migration"
  psql -v ON_ERROR_STOP=1 -v version="$version" -c \
    "insert into app_migrations.applied(version) values (:'version')"
done
