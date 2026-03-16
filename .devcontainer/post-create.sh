#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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
PIP_NO_CACHE_DIR=1 pip install --upgrade pip >/dev/null
PIP_NO_CACHE_DIR=1 pip install -r backend/requirements.txt >/dev/null

deactivate

cd frontend
npm ci --no-audit --no-fund >/dev/null
