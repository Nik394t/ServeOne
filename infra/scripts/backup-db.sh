#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="$ROOT_DIR/infra/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
TARGET_FILE="$BACKUP_DIR/serveone_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"
cd "$ROOT_DIR"

docker compose -f docker-compose.prod.yml exec -T db sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$TARGET_FILE"

echo "Backup saved: $TARGET_FILE"
