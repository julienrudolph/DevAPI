#!/bin/sh
set -eu

psql \
  --set=ON_ERROR_STOP=1 \
  --set=role_password="$POSTGRES_PASSWORD" \
  <<'SQL'
alter role supabase_auth_admin
  with login password :'role_password';
alter role authenticator
  with login password :'role_password';
SQL
