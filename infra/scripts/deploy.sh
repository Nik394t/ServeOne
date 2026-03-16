#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo ".env не найден. Создан шаблон .env. Заполни секреты и перезапусти deploy.sh"
  exit 1
fi

docker compose -f docker-compose.prod.yml up -d --build

docker compose -f docker-compose.prod.yml ps
