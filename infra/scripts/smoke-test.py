#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from http.cookiejar import CookieJar
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT_DIR / '.env'


@dataclass
class EnvConfig:
    proxy_port: str = '80'
    first_creator_login: str = 'Nikki394t'
    first_creator_password: str = 'Tfz+3940'


def load_env(path: Path) -> EnvConfig:
    config = EnvConfig()
    if not path.exists():
        return config

    raw: dict[str, str] = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        raw[key.strip()] = value.strip().strip('"').strip("'")

    config.proxy_port = raw.get('PROXY_PORT', config.proxy_port)
    config.first_creator_login = raw.get('FIRST_CREATOR_LOGIN', config.first_creator_login)
    config.first_creator_password = raw.get('FIRST_CREATOR_PASSWORD', config.first_creator_password)
    return config


class SmokeClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.cookie_jar = CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookie_jar))

    def request(self, method: str, path: str, *, data: dict | None = None, expected_status: int = 200) -> tuple[int, str]:
        body = None
        headers = {'Accept': 'application/json, text/html;q=0.9,*/*;q=0.8'}
        if data is not None:
            body = json.dumps(data).encode('utf-8')
            headers['Content-Type'] = 'application/json'
        request = urllib.request.Request(f'{self.base_url}{path}', data=body, headers=headers, method=method)
        try:
            with self.opener.open(request, timeout=15) as response:
                payload = response.read().decode('utf-8', errors='replace')
                status = response.getcode()
        except urllib.error.HTTPError as exc:
            payload = exc.read().decode('utf-8', errors='replace')
            status = exc.code
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(f'{method} {path} failed: {exc}') from exc

        if status != expected_status:
            raise RuntimeError(f'{method} {path} returned {status}, expected {expected_status}. Body: {payload[:400]}')
        return status, payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='ServeOne production smoke-test')
    parser.add_argument('--base-url', default=None, help='Base URL for proxy, e.g. http://127.0.0.1:80')
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    env = load_env(ENV_PATH)
    base_url = args.base_url or f'http://127.0.0.1:{env.proxy_port}'
    client = SmokeClient(base_url)

    checks: list[str] = []

    _, login_page = client.request('GET', '/login', expected_status=200)
    if 'ServeOne' not in login_page:
        raise RuntimeError('Login page loaded, but expected ServeOne marker not found')
    checks.append('GET /login')

    _, health_payload = client.request('GET', '/api/backend/health/deep', expected_status=200)
    health = json.loads(health_payload)
    if health.get('status') != 'ok' or health.get('database') != 'ok':
        raise RuntimeError(f'Unexpected health payload: {health_payload}')
    checks.append('GET /api/backend/health/deep')

    _, auth_payload = client.request(
        'POST',
        '/api/backend/auth/login',
        data={
            'login': env.first_creator_login,
            'password': env.first_creator_password,
            'remember_me': True,
        },
        expected_status=200,
    )
    auth = json.loads(auth_payload)
    if auth.get('user', {}).get('login') != env.first_creator_login:
        raise RuntimeError('Login succeeded but returned unexpected user payload')
    checks.append('POST /api/backend/auth/login')

    _, me_payload = client.request('GET', '/api/backend/auth/me', expected_status=200)
    me = json.loads(me_payload)
    if me.get('user', {}).get('role') not in {'creator', 'admin', 'user'}:
        raise RuntimeError(f'Unexpected /auth/me payload: {me_payload}')
    checks.append('GET /api/backend/auth/me')

    _, dashboard_page = client.request('GET', '/dashboard', expected_status=200)
    if 'ServeOne' not in dashboard_page and '__NEXT_DATA__' not in dashboard_page and '_next/static' not in dashboard_page:
        raise RuntimeError('Dashboard loaded, but expected frontend markers not found')
    checks.append('GET /dashboard')

    print('Smoke-test passed')
    print(f'Base URL: {base_url}')
    for item in checks:
        print(f' - {item}')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f'Smoke-test failed: {exc}', file=sys.stderr)
        raise SystemExit(1)
