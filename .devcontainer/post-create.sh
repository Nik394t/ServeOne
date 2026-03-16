#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -n "${NVM_DIR:-}" && -s "$NVM_DIR/nvm.sh" ]]; then
  # Keep Codespaces frontend runtime aligned with the project target.
  . "$NVM_DIR/nvm.sh"
  nvm install 22 >/dev/null
  nvm use 22 >/dev/null
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

python3 - <<'PY'
from pathlib import Path
path = Path('.env')
text = path.read_text(encoding='utf-8')
replacements = {
    'BACKEND_INTERNAL_URL=http://backend:8000/api/v1': 'BACKEND_INTERNAL_URL=http://127.0.0.1:8000/api/v1',
    'BACKEND_CORS_ORIGINS=http://localhost:3000': 'BACKEND_CORS_ORIGINS=http://localhost:3000',
}
for src, dst in replacements.items():
    text = text.replace(src, dst)
path.write_text(text, encoding='utf-8')
PY

if [[ ! -d backend/.venv ]]; then
  python3 -m venv backend/.venv
fi

source backend/.venv/bin/activate
pip install --upgrade pip >/dev/null
pip install -r backend/requirements.txt >/dev/null

deactivate

cd frontend
npm ci >/dev/null
