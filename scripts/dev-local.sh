#!/usr/bin/env bash

set -euo pipefail

# pnpm forwards a literal `--` to shell scripts; Next expects only its flags.
if [[ "${1:-}" == "--" ]]; then
  shift
fi

if ! supabase status --output env >/dev/null 2>&1; then
  echo "Local Supabase is not running. Start it with: pnpm db:start" >&2
  exit 1
fi

# `supabase status --output env` emits the local URL and ephemeral local keys.
# These exports intentionally override the stale remote Supabase variables in
# .env.local while preserving the existing Clerk and optional AI credentials.
eval "$(supabase status --output env)"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export ESTRUS_LOCAL_DEVELOPMENT=true

exec ./node_modules/.bin/next dev "$@"
