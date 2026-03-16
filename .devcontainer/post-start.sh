#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.devcontainer/logs"
mkdir -p "$LOG_DIR"

if [[ -n "${NVM_DIR:-}" && -s "$NVM_DIR/nvm.sh" ]]; then
  . "$NVM_DIR/nvm.sh"
  nvm use 22 >/dev/null
fi

wait_for_postgres() {
  python3 - <<'PY'
import socket
import time

host = 'db'
port = 5432
for _ in range(60):
    try:
        with socket.create_connection((host, port), timeout=2):
            raise SystemExit(0)
    except OSError:
        time.sleep(2)
raise SystemExit(1)
PY
}

start_backend() {
  (
    cd "$ROOT_DIR/backend"
    source .venv/bin/activate
    nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > "$LOG_DIR/backend.log" 2>&1 &
  )
}

start_frontend() {
  (
    cd "$ROOT_DIR/frontend"
    nohup npm run dev -- --hostname 0.0.0.0 --port 3000 > "$LOG_DIR/frontend.log" 2>&1 &
  )
}

pkill -f "uvicorn app.main:app --host 0.0.0.0 --port 8000" >/dev/null 2>&1 || true
pkill -f "next dev --hostname 0.0.0.0 --port 3000" >/dev/null 2>&1 || true

if ! wait_for_postgres; then
  echo "Postgres did not become ready in time" > "$LOG_DIR/backend.log"
  exit 1
fi

start_backend
sleep 5
if ! curl -fsS http://127.0.0.1:8000/api/v1/health >/dev/null 2>&1; then
  echo "Backend did not start cleanly. See $LOG_DIR/backend.log"
fi

start_frontend
sleep 8
if ! curl -fsS http://127.0.0.1:3000/login >/dev/null 2>&1; then
  echo "Frontend did not start cleanly. See $LOG_DIR/frontend.log"
fi

echo "ServeOne Codespace preview is starting."
echo " - Frontend: port 3000"
echo " - Backend:  port 8000"
echo " - Logs: $LOG_DIR"
