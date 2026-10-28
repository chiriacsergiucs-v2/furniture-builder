#!/usr/bin/env bash
# Test the Supabase migration's server rules on a throwaway local PostgreSQL (ADR-127, ADR-128, ADR-132).
# Usage: bash tools/supabase/test-sql.sh   — needs initdb/pg_ctl (PostgreSQL 15+) on PATH or under /usr/lib/postgresql.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
BIN="$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")"
DIR="$(mktemp -d)"
# PostgreSQL refuses to run as root: in a root container, run the server as the postgres user.
AS=()
if [ "$(id -u)" = 0 ]; then chown postgres "$DIR"; chmod 755 "$DIR"; AS=(runuser -u postgres --); fi
trap '"${AS[@]}" "$BIN/pg_ctl" -D "$DIR/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
"${AS[@]}" "$BIN/initdb" -D "$DIR/data" -U postgres -A trust >/dev/null
"${AS[@]}" "$BIN/pg_ctl" -D "$DIR/data" -o "-k $DIR -p 54329 -c listen_addresses=''" -l "$DIR/log" start >/dev/null
PSQL=(psql -h "$DIR" -p 54329 -U postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -c 'create database t' >/dev/null
"${PSQL[@]}" -d t -f tools/supabase/stub-auth.sql >/dev/null
"${PSQL[@]}" -d t -f supabase/migrations/20261028000000_accounts.sql >/dev/null
"${PSQL[@]}" -d t -f tools/supabase/test.sql
