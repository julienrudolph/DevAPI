#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
env_file="$repo_dir/.env.selfhosted"
backup_file="${1:-}"
confirmation="${2:-}"

if [[ -z "$backup_file" || "$confirmation" != "--confirm-data-loss" ]]; then
  echo "Verwendung: scripts/restore-selfhosted-backup.sh <backup.dump> --confirm-data-loss" >&2
  exit 2
fi
if [[ ! -f "$env_file" || ! -f "$backup_file" ]]; then
  echo "Konfiguration oder Backup-Datei fehlt." >&2
  exit 1
fi
if [[ -L "$backup_file" ]]; then
  echo "Symlinks sind als Restore-Quelle nicht erlaubt." >&2
  exit 1
fi

data_dir="$(sed -n 's/^DEVAPI_DATA_DIR=//p' "$env_file" | tail -n 1)"
if [[ -z "$data_dir" || "$data_dir" != /* ]]; then
  echo "DEVAPI_DATA_DIR fehlt oder ist nicht absolut." >&2
  exit 1
fi
mkdir -p -- "$data_dir/backups"

compose=(
  docker compose
  --env-file "$env_file"
  -f "$repo_dir/compose.yaml"
  -f "$repo_dir/compose.selfhosted.yaml"
  -f "$repo_dir/compose.npm-proxy.yaml"
)

exec 9>"$repo_dir/.restore.lock"
if ! flock -n 9; then
  echo "Ein anderes Restore läuft bereits." >&2
  exit 1
fi

echo "Prüfe Backup vor dem produktiven Restore."
"$repo_dir/scripts/verify-database-backup.sh" "$backup_file"

emergency_backup="$data_dir/backups/pre-restore-$(date -u +%Y%m%dT%H%M%SZ).dump"
echo "Erstelle Notfall-Backup des aktuellen Zustands: $emergency_backup"
"${compose[@]}" exec -T db \
  pg_dump -U supabase_admin -d postgres -Fc >"$emergency_backup"
chmod 600 "$emergency_backup"

echo "Stoppe datenbankabhängige Dienste."
"${compose[@]}" stop web api proxy supabase-gateway rest auth db-backup

restore_failed=false
if ! "${compose[@]}" exec -T db \
  pg_restore -U supabase_admin -d postgres \
  --clean --if-exists --exit-on-error <"$backup_file"; then
  restore_failed=true
fi

if [[ "$restore_failed" == true ]]; then
  echo "Restore fehlgeschlagen. Notfall-Backup wird eingespielt." >&2
  "${compose[@]}" exec -T db \
    pg_restore -U supabase_admin -d postgres \
    --clean --if-exists --exit-on-error <"$emergency_backup"
  "${compose[@]}" up -d --wait
  echo "Der vorherige Datenbankzustand wurde wiederhergestellt." >&2
  exit 1
fi

"${compose[@]}" up -d --wait
echo "Restore erfolgreich."
echo "Quelle:          $backup_file"
echo "Notfall-Backup:  $emergency_backup"
