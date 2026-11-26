#!/usr/bin/env bash
# Throwaway local PostgreSQL check of the scheduling migration. Never targets Supabase.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bin="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
data="$(mktemp -d)"; port="${PG_TEST_PORT:-54329}"
"$bin/initdb" -D "$data" -U postgres -A trust >/dev/null
"$bin/pg_ctl" -D "$data" -o "-p $port -k $data" -l "$data/log" -w start >/dev/null
trap '"$bin/pg_ctl" -D "$data" -m fast stop >/dev/null; rm -rf "$data"' EXIT
psql=(psql -h "$data" -p "$port" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${psql[@]}" -f "$here/stub-schema.sql"
"${psql[@]}" -f "$here/../../supabase/migrations/20261126120000_foxon_scheduled_publishing.sql"
"${psql[@]}" -f "$here/../../supabase/migrations/20261126120000_foxon_scheduled_publishing.sql"  # idempotent re-run
"${psql[@]}" -f "$here/scheduled-publishing.test.sql"
