#!/bin/sh
set -eu

interval="${BACKUP_INTERVAL_SECONDS:-86400}"
retention_days="${BACKUP_RETENTION_DAYS:-30}"
trap 'exit 0' TERM INT

case "$interval" in
  *[!0-9]*|"") echo "BACKUP_INTERVAL_SECONDS muss eine positive Ganzzahl sein." >&2; exit 1 ;;
esac
case "$retention_days" in
  *[!0-9]*|"") echo "BACKUP_RETENTION_DAYS muss eine positive Ganzzahl sein." >&2; exit 1 ;;
esac

while true; do
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  temporary="/backups/.devapi-${timestamp}.dump.tmp"
  target="/backups/devapi-${timestamp}.dump"

  umask 077
  if pg_dump --format=custom --file="$temporary"; then
    mv "$temporary" "$target"
    echo "Datenbanksicherung erstellt: $(basename "$target")"
    find /backups \
      -type f \
      -name "devapi-*.dump" \
      -mtime "+$retention_days" \
      -delete
  else
    rm -f "$temporary"
    echo "Datenbanksicherung fehlgeschlagen." >&2
  fi

  sleep "$interval"
done
