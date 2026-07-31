#!/usr/bin/env bash
set -Eeuo pipefail

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$repo_dir/.env.selfhosted"
public_url=""
data_dir=""
npm_network="botnet"
non_interactive=false

usage() {
  cat <<'EOF'
DevAPI Self-Hosting einrichten

Interaktiv:
  ./scripts/setup-selfhosted.sh

Automatisiert:
  ./scripts/setup-selfhosted.sh \
    --url https://devapi.example.de \
    --data-dir /srv/devapi/data \
    --npm-network botnet \
    --non-interactive

Das Skript startet keine Container. Es erzeugt die Konfiguration, prüft sie
und gibt anschließend den Docker-Compose-Startbefehl aus.
EOF
}

validate_url() {
  if [[ ! "$public_url" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?$ ]]; then
    echo "Die URL muss vollständig sein, HTTPS verwenden und darf keinen Pfad enthalten." >&2
    exit 1
  fi
}

validate_data_directory() {
  if [[ -z "$data_dir" || "$data_dir" != /* || "$data_dir" == "/" ]]; then
    echo "Das Datenverzeichnis muss ein absoluter Pfad sein und darf nicht / sein." >&2
    exit 1
  fi
  if [[ "$data_dir" == *$'\n'* || "$data_dir" == *$'\r'* || "$data_dir" == *:* ]]; then
    echo "Das Datenverzeichnis enthält nicht unterstützte Zeichen." >&2
    exit 1
  fi
  case "$data_dir" in
    /bin|/boot|/dev|/etc|/home|/lib|/lib64|/proc|/root|/run|/sbin|/sys|/usr|/var)
      echo "Das Datenverzeichnis ist zu breit oder ein Systemverzeichnis: $data_dir" >&2
      exit 1
      ;;
  esac
}

random_secret() {
  openssl rand -base64 "$1" | tr -d '\n=' | tr '+/' '-_'
}

base64url() {
  openssl base64 -A | tr -d '=' | tr '+/' '-_'
}

sign_jwt() {
  local secret="$1"
  local issued_at="$2"
  local expires_at="$3"
  local header payload signing_input signature
  header="$(printf '%s' '{"alg":"HS256","typ":"JWT"}' | base64url)"
  payload="$(
    printf '{"role":"anon","iss":"supabase","iat":%s,"exp":%s}' \
      "$issued_at" "$expires_at" | base64url
  )"
  signing_input="$header.$payload"
  signature="$(
    printf '%s' "$signing_input" |
      openssl dgst -sha256 -mac HMAC -macopt "key:$secret" -binary |
      base64url
  )"
  printf '%s.%s' "$signing_input" "$signature"
}

while (($# > 0)); do
  case "$1" in
    --url)
      public_url="${2:-}"
      shift 2
      ;;
    --data-dir)
      data_dir="${2:-}"
      shift 2
      ;;
    --npm-network)
      npm_network="${2:-}"
      shift 2
      ;;
    --non-interactive)
      non_interactive=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unbekannte Option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

command -v docker >/dev/null 2>&1 || {
  echo "Docker wurde nicht gefunden." >&2
  exit 1
}
docker compose version >/dev/null 2>&1 || {
  echo "Das Docker-Compose-Plugin wurde nicht gefunden." >&2
  exit 1
}
command -v openssl >/dev/null 2>&1 || {
  echo "OpenSSL wurde nicht gefunden." >&2
  exit 1
}

if [[ -e "$env_file" ]]; then
  echo "$env_file existiert bereits." >&2
  echo "Aus Sicherheitsgründen werden bestehende Secrets nicht überschrieben." >&2
  exit 1
fi

if [[ "$non_interactive" == false ]]; then
  echo "DevAPI vollständig selbst gehostet einrichten"
  echo
  read -r -p "Öffentliche HTTPS-URL: " public_url
  read -r -p "Absolutes Datenverzeichnis [/srv/devapi/data]: " data_dir
  data_dir="${data_dir:-/srv/devapi/data}"
  read -r -p "Docker-Netzwerk des Nginx Proxy Managers [botnet]: " npm_network
  npm_network="${npm_network:-botnet}"
fi

validate_url
validate_data_directory

if [[ ! "$npm_network" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]]; then
  echo "Der Docker-Netzwerkname ist ungültig." >&2
  exit 1
fi

if ! docker network inspect "$npm_network" >/dev/null 2>&1; then
  echo "Das externe Docker-Netzwerk '$npm_network' existiert nicht." >&2
  echo "Nginx Proxy Manager muss diesem Netzwerk bereits angehören." >&2
  exit 1
fi

mkdir -p -- "$data_dir/postgres" "$data_dir/backups"
chmod 700 "$data_dir" "$data_dir/postgres" "$data_dir/backups"

if find "$data_dir/postgres" -mindepth 1 -maxdepth 1 -print -quit | grep -q .; then
  echo "Das PostgreSQL-Verzeichnis ist nicht leer: $data_dir/postgres" >&2
  echo "Für eine neue Installation wird ein leeres Verzeichnis benötigt." >&2
  exit 1
fi

jwt_secret="$(random_secret 48)"
postgres_password="$(random_secret 32)"
proxy_token="$(random_secret 48)"
now="$(date +%s)"
expires="$((now + 315360000))"
anon_key="$(sign_jwt "$jwt_secret" "$now" "$expires")"
public_host="${public_url#https://}"
public_host="${public_host%%/*}"

umask 077
{
  printf 'NPM_NETWORK=%s\n' "$npm_network"
  printf 'DEVAPI_DATA_DIR=%s\n\n' "$data_dir"
  printf 'PUBLIC_HOST=%s\n' "$public_host"
  printf 'SITE_URL=%s\n' "$public_url"
  printf 'SUPABASE_PUBLIC_URL=%s\n' "$public_url"
  printf 'SUPABASE_INTERNAL_URL=http://supabase-gateway:8000\n\n'
  printf 'POSTGRES_PASSWORD=%s\n' "$postgres_password"
  printf 'JWT_SECRET=%s\n' "$jwt_secret"
  printf 'SUPABASE_PUBLISHABLE_KEY=%s\n' "$anon_key"
  printf 'PROXY_INTERNAL_TOKEN=%s\n\n' "$proxy_token"
  printf 'PASSWORD_AUTH_ENABLED=true\n'
  printf 'PASSWORD_SIGNUP_ENABLED=true\n'
  printf 'MAGIC_LINK_AUTH_ENABLED=false\n'
  printf 'AUTH_DISABLE_SIGNUP=false\n'
  printf 'AUTH_AUTOCONFIRM=true\n\n'
  printf 'OIDC_PROVIDER=\n'
  printf 'OIDC_LABEL=Mit Firmenkonto anmelden\n\n'
  printf 'SMTP_ADMIN_EMAIL=devapi@localhost\n'
  printf 'SMTP_HOST=localhost\n'
  printf 'SMTP_PORT=25\n'
  printf 'SMTP_USER=\n'
  printf 'SMTP_PASS=\n'
  printf 'SMTP_SENDER_NAME=DevAPI\n\n'
  printf 'BACKUP_INTERVAL_SECONDS=86400\n'
  printf 'BACKUP_RETENTION_DAYS=30\n'
} >"$env_file"
chmod 600 "$env_file"

compose=(docker compose
  --env-file "$env_file"
  -f "$repo_dir/compose.yaml"
  -f "$repo_dir/compose.selfhosted.yaml"
  -f "$repo_dir/compose.npm-proxy.yaml")

if ! "${compose[@]}" config --quiet; then
  echo "Die erzeugte Compose-Konfiguration ist ungültig." >&2
  exit 1
fi

cat <<EOF

Einrichtung abgeschlossen.

Konfiguration: $env_file
PostgreSQL:    $data_dir/postgres
Backups:       $data_dir/backups

Nginx Proxy Manager:
  Forward Hostname: devapi-web
  Forward Port:     8080
  Scheme:           http

Stack starten:

docker compose \\
  --env-file "$env_file" \\
  -f "$repo_dir/compose.yaml" \\
  -f "$repo_dir/compose.selfhosted.yaml" \\
  -f "$repo_dir/compose.npm-proxy.yaml" \\
  up -d --build --wait
EOF
