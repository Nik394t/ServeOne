# ServeOne Deploy

Важно: GitHub не является сервером для постоянной работы `FastAPI + PostgreSQL + Next.js`.

Здесь схема такая:
- GitHub = исходный код, CI, release, deploy trigger
- внешний сервер = реальный runtime для приложения

Текущий автодеплой рассчитан на Linux-сервер с Docker и Docker Compose.

## 1. Что должно быть на сервере

Нужно установить:
- Docker
- Docker Compose plugin
- `rsync`
- `python3`

Нужно создать директорию проекта, например:
- `/opt/serveone`

В этой директории должен лежать production `.env`.

## 2. Что положить в `.env` на сервере

Минимум:

```env
POSTGRES_DB=serveone
POSTGRES_USER=serveone
POSTGRES_PASSWORD=CHANGE_ME_DB
DATABASE_URL=postgresql+psycopg://serveone:CHANGE_ME_DB@db:5432/serveone
JWT_SECRET=CHANGE_ME_JWT
JWT_ACCESS_EXPIRE_MINUTES=30
JWT_REFRESH_EXPIRE_DAYS=30
FIRST_CREATOR_LOGIN=Nikki394t
FIRST_CREATOR_PASSWORD=CHANGE_ME_CREATOR
FIRST_CREATOR_FULL_NAME=Creator
BACKEND_CORS_ORIGINS=https://your-domain.com
NEXT_PUBLIC_APP_NAME=ServeOne
BACKEND_INTERNAL_URL=http://backend:8000/api/v1
PROXY_PORT=80
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@serveone.local
```

## 3. GitHub Secrets

В репозитории `ServeOne` нужно создать secrets:
- `DEPLOY_HOST` — адрес сервера
- `DEPLOY_PORT` — SSH порт, обычно `22`
- `DEPLOY_USER` — пользователь на сервере
- `DEPLOY_PATH` — путь проекта на сервере, например `/opt/serveone`
- `DEPLOY_SSH_KEY` — приватный SSH-ключ GitHub Actions
- `DEPLOY_KNOWN_HOSTS` — результат `ssh-keyscan -H your-host`

## 4. Как подготовить SSH

Локально создаёшь отдельный deploy key:

```bash
ssh-keygen -t ed25519 -C "serveone-deploy" -f ~/.ssh/serveone_deploy
```

Дальше:
- публичный ключ `~/.ssh/serveone_deploy.pub` добавить на сервер в `~/.ssh/authorized_keys`
- приватный ключ `~/.ssh/serveone_deploy` положить в GitHub Secret `DEPLOY_SSH_KEY`
- known_hosts получить так:

```bash
ssh-keyscan -H your-domain.com
```

и положить в `DEPLOY_KNOWN_HOSTS`

## 5. Что делают workflow

### CI
Файл:
- `.github/workflows/ci.yml`

Проверяет:
- frontend lint
- frontend build
- backend compile
- smoke-test script compile

### Deploy
Файл:
- `.github/workflows/deploy.yml`

После push в `main` или ручного запуска:
- прогоняет проверки
- подключается к серверу по SSH
- синхронизирует репозиторий в `DEPLOY_PATH`
- запускает:
  - `./infra/scripts/deploy.sh`
  - `./infra/scripts/verify-prod.sh`

### Release
Файл:
- `.github/workflows/release.yml`

При push тега вида `v1.0.0` создаёт GitHub Release.

## 6. Как выпускать релиз

```bash
git tag v1.0.0
git push origin v1.0.0
```

## 7. Как руками проверить сервер

На сервере:

```bash
cd /opt/serveone
./infra/scripts/deploy.sh
./infra/scripts/verify-prod.sh
```

## 8. Что важно

- `.env` не отправляется из GitHub на сервер, он хранится только на сервере
- `infra/scripts/verify-prod.sh` выполняет smoke-test и выводит логи, если что-то сломалось
- текущий deploy workflow рассчитан именно на Linux-сервер
