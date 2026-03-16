#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${1:-$ROOT_DIR/.env.pages}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE"
  echo "Copy $ROOT_DIR/.env.pages.example to $ROOT_DIR/.env.pages and adjust values."
  exit 1
fi

cd "$ROOT_DIR"
docker compose --env-file "$ENV_FILE" up -d db backend

echo "ServeOne backend started for GitHub Pages mode."
echo "Health: http://localhost:8000/api/v1/health"
echo "Use a public HTTPS tunnel for localhost:8000 if you need external access."
