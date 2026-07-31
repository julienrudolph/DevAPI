#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
env_file="$repo_dir/.env.selfhosted"
target_ref="${1:-}"

if [[ -z "$target_ref" ]]; then
  echo "Verwendung: scripts/deploy-selfhosted-version.sh <Git-Tag-oder-Commit>" >&2
  exit 2
fi
if [[ ! -f "$env_file" ]]; then
  echo "$env_file fehlt. Führe zuerst das Self-Hosted-Setup aus." >&2
  exit 1
fi
if [[ -n "$(git -C "$repo_dir" status --porcelain)" ]]; then
  echo "Das Repository enthält ungespeicherte Änderungen. Deployment abgebrochen." >&2
  exit 1
fi

exec 9>"$repo_dir/.deploy.lock"
if ! flock -n 9; then
  echo "Ein anderes Deployment läuft bereits." >&2
  exit 1
fi

compose=(
  docker compose
  --env-file "$env_file"
  -f "$repo_dir/compose.yaml"
  -f "$repo_dir/compose.selfhosted.yaml"
  -f "$repo_dir/compose.npm-proxy.yaml"
)

previous_commit="$(git -C "$repo_dir" rev-parse HEAD)"
git -C "$repo_dir" fetch --tags --prune origin
target_commit="$(git -C "$repo_dir" rev-parse --verify "${target_ref}^{commit}")"
data_dir="$(sed -n 's/^DEVAPI_DATA_DIR=//p' "$env_file" | tail -n 1)"
if [[ -z "$data_dir" || "$data_dir" != /* ]]; then
  echo "DEVAPI_DATA_DIR fehlt oder ist nicht absolut." >&2
  exit 1
fi

backup_dir="$data_dir/backups"
mkdir -p -- "$backup_dir"
backup_file="$backup_dir/pre-deploy-$(date -u +%Y%m%dT%H%M%SZ)-${previous_commit:0:12}.dump"

echo "Erstelle Sicherung: $backup_file"
"${compose[@]}" exec -T db \
  pg_dump -U supabase_admin -d postgres -Fc >"$backup_file"
chmod 600 "$backup_file"

echo "Deploye $target_commit"
git -C "$repo_dir" checkout --detach "$target_commit"
if "${compose[@]}" up -d --build --wait; then
  printf '%s\n' "$target_commit" >"$data_dir/deployed-version"
  printf '%s\n' "$previous_commit" >"$data_dir/previous-version"
  echo "Deployment erfolgreich."
  echo "Version: $target_commit"
  echo "Backup:  $backup_file"
  exit 0
fi

echo "Deployment fehlgeschlagen. Stelle Anwendungsstand $previous_commit wieder her." >&2
git -C "$repo_dir" checkout --detach "$previous_commit"
"${compose[@]}" up -d --build --wait
echo "Die Container wurden zurückgerollt." >&2
echo "Die Datenbank wurde nicht automatisch zurückgesetzt: $backup_file" >&2
exit 1
