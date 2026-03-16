#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.devcontainer/logs"
mkdir -p "$LOG_DIR"

if [[ -n "${NVM_DIR:-}" && -s "$NVM_DIR/nvm.sh" ]]; then
  . "$NVM_DIR/nvm.sh"
  nvm use 22 >/dev/null
fi

pkill -f "uvicorn app.main:app --host 0.0.0.0 --port 8000" >/dev/null 2>&1 || true
pkill -f "next dev --hostname 0.0.0.0 --port 3000" >/dev/null 2>&1 || true

(
  cd "$ROOT_DIR/backend"
  source .venv/bin/activate
  nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > "$LOG_DIR/backend.log" 2>&1 &
)

(
  cd "$ROOT_DIR/frontend"
  nohup npm run dev -- --hostname 0.0.0.0 --port 3000 > "$LOG_DIR/frontend.log" 2>&1 &
)

echo "ServeOne Codespace preview is starting."
echo " - Frontend: port 3000"
echo " - Backend:  port 8000"
