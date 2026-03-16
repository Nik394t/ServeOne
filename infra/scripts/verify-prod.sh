#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_CMD=(docker compose -f docker-compose.prod.yml)

printf '\n[1/3] Containers\n'
"${COMPOSE_CMD[@]}" ps

printf '\n[2/3] Smoke-test\n'
if ! ./infra/scripts/smoke-test.sh "$@"; then
  printf '\nSmoke-test failed. Recent logs:\n'
  "${COMPOSE_CMD[@]}" logs --tail 120 proxy frontend backend db
  exit 1
fi

printf '\n[3/3] Recent logs snapshot\n'
"${COMPOSE_CMD[@]}" logs --tail 30 proxy frontend backend db
