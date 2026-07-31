#!/bin/sh
set -eu

repo_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
env_file="$repo_dir/.env.compose"

if [ ! -f "$env_file" ]; then
  echo ".env.compose fehlt. Führe zuerst 'npm run compose:env' aus." >&2
  exit 1
fi

for test_file in "$repo_dir"/supabase/tests/*.sql; do
  echo "Datenbanktest: $(basename "$test_file")"
  docker compose \
    --env-file "$env_file" \
    -f "$repo_dir/compose.yaml" \
    -f "$repo_dir/compose.local.yaml" \
    exec -T db \
    psql -U supabase_admin -d postgres -f - < "$test_file"
done
