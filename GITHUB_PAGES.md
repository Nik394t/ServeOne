# ServeOne: GitHub Pages + отдельный backend

Эта схема повторяет запуск `Daily`:

1. `GitHub Pages` публикует только статический frontend.
2. `backend` запускается отдельно.
3. frontend подключается к backend через:
   - `NEXT_PUBLIC_API_BASE_URL` на этапе сборки
   - query param `?api=https://...`
   - runtime-поле `Cloud API URL` в интерфейсе

## 1. Что уже подготовлено

- GitHub Pages workflow:
  - `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/.github/workflows/pages.yml`
- static export frontend:
  - `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/frontend/next.config.mjs`
  - `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/frontend/package.json`
- runtime API URL:
  - `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/frontend/lib/api.ts`
  - `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/frontend/components/login-form.tsx`
  - `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/frontend/components/settings-management.tsx`
- backend для cross-site cookies и Pages:
  - `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/backend/app/api/v1/endpoints/auth.py`
  - `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/backend/app/core/config.py`
  - `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/backend/app/services/push.py`
- helper для backend запуска:
  - `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/infra/scripts/start-pages-backend.sh`
  - `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/infra/scripts/start-pages-backend.bat`
- пример env для Pages backend:
  - `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/.env.pages.example`

## 2. Публикация frontend в GitHub Pages

Репозиторий уже: [github.com/Nik394t/ServeOne](https://github.com/Nik394t/ServeOne)

После push в `main` workflow:

- собирает static export
- публикует его в GitHub Pages

Ожидаемый URL:

- `https://nik394t.github.io/ServeOne/`

Если хочешь задать backend прямо на этапе сборки, в GitHub repository variables добавь:

- `PAGES_API_BASE_URL=https://your-backend.example.com/api/v1`

Но это не обязательно: frontend умеет принимать backend URL runtime-способом.

## 3. Запуск отдельного backend

### Вариант через Docker Compose

1. Создай env:

```bash
cp .env.pages.example .env.pages
```

2. Проверь ключевые значения в `.env.pages`:

- `BACKEND_CORS_ORIGINS=https://nik394t.github.io`
- `FRONTEND_APP_URL=https://nik394t.github.io/ServeOne/`
- `AUTH_COOKIE_SECURE=true`
- `AUTH_COOKIE_SAMESITE=none`

3. Запусти backend и Postgres:

```bash
./infra/scripts/start-pages-backend.sh
```

На Windows:

```bat
infra\scripts\start-pages-backend.bat
```

4. Проверка:

```bash
curl http://localhost:8000/api/v1/health
```

## 4. Временный публичный HTTPS-доступ к backend

Для теста можно открыть туннель так же, как в `Daily`:

```bash
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 80:localhost:8000 nokey@localhost.run
```

После этого получишь внешний адрес вида:

- `https://xxxxxxxxxxxx.lhr.life`

Проверка:

```bash
curl https://xxxxxxxxxxxx.lhr.life/api/v1/health
```

## 5. Подключение frontend к backend

Есть 3 варианта.

### Вариант 1. Query param

```text
https://nik394t.github.io/ServeOne/?api=https://xxxxxxxxxxxx.lhr.life/api/v1
```

### Вариант 2. Поле `Cloud API URL`

В самом приложении:

1. открыть экран входа
2. вставить `https://xxxxxxxxxxxx.lhr.life/api/v1`
3. нажать `Сохранить API`
4. войти

### Вариант 3. GitHub variable

Добавить в репозиторий:

- `PAGES_API_BASE_URL=https://your-backend.example.com/api/v1`

Тогда frontend будет знать backend URL уже после сборки.

## 6. Что важно для auth

Для схемы `GitHub Pages -> внешний backend` нужны именно такие настройки backend:

- `AUTH_COOKIE_SECURE=true`
- `AUTH_COOKIE_SAMESITE=none`
- `BACKEND_CORS_ORIGINS=https://nik394t.github.io`

Иначе браузер не будет отправлять auth cookies между доменами.

## 7. Что важно для push

Чтобы push открывал правильный маршрут внутри GitHub Pages приложения, backend должен знать frontend URL:

- `FRONTEND_APP_URL=https://nik394t.github.io/ServeOne/`

Тогда уведомления будут вести в правильный путь внутри `ServeOne`, а не в корень домена.
