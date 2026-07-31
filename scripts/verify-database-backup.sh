#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
local_mode=false
if [[ "${1:-}" == "--local" ]]; then
  local_mode=true
  shift
fi
backup_file="${1:-}"
if [[ -z "$backup_file" || ! -f "$backup_file" ]]; then
  echo "Verwendung: scripts/verify-database-backup.sh [--local] <backup.dump>" >&2
  exit 2
fi

if [[ "$local_mode" == true ]]; then
  env_file="$repo_dir/.env.compose"
  compose_files=(-f "$repo_dir/compose.yaml" -f "$repo_dir/compose.local.yaml")
else
  env_file="$repo_dir/.env.selfhosted"
  compose_files=(
    -f "$repo_dir/compose.yaml"
    -f "$repo_dir/compose.selfhosted.yaml"
    -f "$repo_dir/compose.npm-proxy.yaml"
  )
fi
if [[ ! -f "$env_file" ]]; then
  echo "$env_file fehlt." >&2
  exit 1
fi

compose=(docker compose --env-file "$env_file" "${compose_files[@]}")
probe_database="devapi_restore_probe_$(date -u +%Y%m%d%H%M%S)_$$"

cleanup() {
  "${compose[@]}" exec -T db \
    psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
    -c "drop database if exists \"$probe_database\" with (force);" \
    >/dev/null 2>&1 || true
}
trap cleanup EXIT

"${compose[@]}" exec -T db \
  psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
  -c "create database \"$probe_database\" template template0;"

if ! "${compose[@]}" exec -T db \
  pg_restore -U supabase_admin -d "$probe_database" --exit-on-error \
  <"$backup_file"; then
  echo "Der Dump konnte nicht wiederhergestellt werden." >&2
  exit 1
fi

"${compose[@]}" exec -T db \
  psql -U supabase_admin -d "$probe_database" -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare
  relation text;
begin
  foreach relation in array array[
    'auth.users',
    'public.teams',
    'public.workspaces',
    'public.requests',
    'public.request_revisions'
  ] loop
    if to_regclass(relation) is null then
      raise exception 'Erforderliche Tabelle fehlt im Backup: %', relation;
    end if;
  end loop;
end;
$$;

select json_build_object(
  'users', (select count(*) from auth.users),
  'teams', (select count(*) from public.teams),
  'workspaces', (select count(*) from public.workspaces),
  'requests', (select count(*) from public.requests),
  'revisions', (select count(*) from public.request_revisions)
) as restored_rows;
SQL

echo "Wiederherstellungsprobe erfolgreich: $backup_file"
