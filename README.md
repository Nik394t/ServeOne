# ServeOne Web App

ServeOne — единая платформа для служения, где команда, задачи, коммуникация и организация собраны в одном пространстве.

Название объединяет две идеи:
- `Serve` — служить, помогать, быть частью общего дела
- `One` — единство, одно место для всего важного

Это современное веб-приложение для команды служения с единым рабочим контуром: пользователи, ротация, дежурства, инструктажи, дни рождения, сообщения, рассылки, отчёты и push-уведомления.

## Что уже сделано
- отдельный `frontend` на Next.js
- отдельный `backend` на FastAPI
- PostgreSQL через Docker Compose
- seed первого пользователя `Creator`
- авторизация по логину и паролю
- `remember me`
- защищённый dashboard shell
- базовая адаптивная навигация
- PWA manifest, service worker и install flow
- модуль `Участники`
- модуль `Служения и ротация` с недельной сеткой, ручными назначениями, напарниками и фиксацией на N служений
- модуль `Дежурства` с очередью, ручным сдвигом, перестановкой, историей и автосдвигом по понедельникам
- модуль `Инструктажи` с привязкой к позициям, редактированием текстов и персональными чек-листами на текущее служение
- модуль `Дни рождения` с календарём команды, формой обращения, шаблонами поздравлений и предпросмотром текста
- модуль `Рассылки` с общей отправкой, сценарием сбора на подарок, выбором получателей и историей кампаний
- модуль `Сообщения` с inbox для рассылок, личной перепиской и ответами админа пользователю
- экран `Настройки` с установкой приложения, управлением push-подпиской и тестовым push
- push-уведомления для новых личных сообщений и рассылок
- модуль `Отчёты` с операционной аналитикой по команде, служениям, дежурствам, чек-листам, коммуникациям и ближайшим дням рождения
- role-based навигация и скрытие лишних разделов для обычного пользователя
- frontend-redirect и backend-ограничения для админских разделов
- персонализированная главная страница для `user / admin / creator`
- UI polishing: обновлён shell, типографика, карточки, mobile-nav и визуальная иерархия ключевых экранов
- усилена адаптация для mobile/tablet на `Главной`, `Отчётах`, `Участниках`, `Служениях`, `Сообщениях` и `Настройках`
- production-ready контур: отдельные production Dockerfile, `docker-compose.prod.yml`, nginx proxy и deploy/backup scripts
- frontend обновлён до `Next.js 15.5.10`, `eslint-config-next 15.5.10`, `npm audit` закрыт до `0 vulnerabilities`

## Первый пользователь
- login: `Nikki394t`
- password: `Tfz+3940`

## Быстрый запуск для разработки
Из папки `web_app`:

```bash
docker compose up -d --build
```

Открыть:
- frontend: `http://localhost:3000`
- backend docs: `http://localhost:8000/docs`

## GitHub Pages + отдельный backend
Для схемы, как в `Daily`, теперь есть отдельная подготовка:
- frontend статически публикуется в GitHub Pages
- backend запускается отдельно
- frontend умеет брать `Cloud API URL` из:
  - `NEXT_PUBLIC_API_BASE_URL`
  - query param `?api=https://...`
  - localStorage через поле в интерфейсе

Файлы:
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/.github/workflows/pages.yml`
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/.env.pages.example`
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/GITHUB_PAGES.md`
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/infra/scripts/start-pages-backend.sh`
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/infra/scripts/start-pages-backend.bat`

Полная инструкция:
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/GITHUB_PAGES.md`

## Временный запуск через GitHub Codespaces
Для быстрого входа в приложение без собственного сервера добавлена конфигурация Codespaces:
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/.devcontainer/devcontainer.json`
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/.devcontainer/docker-compose.yml`

Что происходит:
- Codespaces поднимает dev-контур
- автоматически пробрасываются порты `3000` и `8000`
- frontend открывается в preview на порту `3000`
- backend стартует на порту `8000`

Как открыть:
1. В репозитории GitHub нажать `Code`
2. Перейти в `Codespaces`
3. Нажать `Create codespace on main`
4. Дождаться инициализации
5. Открыть forwarded port `3000`
6. Если встроенный preview пустой, открыть порт `3000` через внешний браузер, а не через `Простой браузер`
7. Для нового Codespace порт `3000` по умолчанию будет `Public`, чтобы страница открывалась без проблем с private-preview

Важно:
- это подходит для временного входа и просмотра приложения
- это не production-хостинг
- если старый Codespace упал по `low disk space`, его нужно удалить и создать новый: конфигурация уже облегчена и переведена на более лёгкий devcontainer-образ
- корневой путь `/` теперь сразу открывает экран входа, чтобы preview не зависел от server-side redirect
- если preview не поднялся автоматически, открыть терминал Codespaces и посмотреть логи:
  - `cat .devcontainer/logs/backend.log`
  - `cat .devcontainer/logs/frontend.log`
- ручной запуск внутри Codespaces:

```bash
cd /workspaces/ServeOne
bash .devcontainer/post-start.sh
```

## Production deploy
Основной production-стек:
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/docker-compose.prod.yml`
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/frontend/Dockerfile.prod`
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/backend/Dockerfile.prod`
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/infra/nginx/serveone.conf`

Шаги:
1. Клонировать репозиторий на сервер.
2. Скопировать `.env.example` в `.env`.
3. Обязательно заменить:
   - `POSTGRES_PASSWORD`
   - `JWT_SECRET`
   - `FIRST_CREATOR_PASSWORD`
   - `BACKEND_CORS_ORIGINS`
   - `VAPID_*`, если нужен push
4. При необходимости поменять `PROXY_PORT`.
5. Запустить:

```bash
./infra/scripts/deploy.sh
```

Для Windows:

```bat
infra\\scripts\\deploy.bat
```

После старта приложение будет доступно на порту `PROXY_PORT`, по умолчанию `80`.

## Smoke-test после deploy
Добавил отдельную автоматическую проверку production-контура:
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/infra/scripts/smoke-test.py`
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/infra/scripts/smoke-test.sh`
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/infra/scripts/smoke-test.bat`

Проверяет:
- `GET /login`
- `GET /api/backend/health/deep`
- `POST /api/backend/auth/login`
- `GET /api/backend/auth/me`
- `GET /dashboard`

Linux/macOS:

```bash
./infra/scripts/smoke-test.sh
```

Windows:

```bat
infra\\scripts\\smoke-test.bat
```

Если proxy поднят не на локальном `127.0.0.1`, можно передать адрес явно:

```bash
./infra/scripts/smoke-test.sh --base-url http://your-host:80
```

## Полная production-проверка
Для одной команды добавил verify-скрипты:
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/infra/scripts/verify-prod.sh`
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/infra/scripts/verify-prod.bat`

Они делают:
- `docker compose ps`
- `smoke-test`
- если smoke-test падает, сразу показывают последние логи `proxy/frontend/backend/db`

Linux/macOS:

```bash
./infra/scripts/verify-prod.sh
```

Windows:

```bat
infra\\scripts\\verify-prod.bat
```

## Backup базы
Сделал отдельные backup-скрипты для production-стека:
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/infra/scripts/backup-db.sh`
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/infra/scripts/backup-db.bat`

Linux/macOS:

```bash
./infra/scripts/backup-db.sh
```

Windows:

```bat
infra\\scripts\\backup-db.bat
```

SQL-бэкапы сохраняются в:
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/infra/backups`

## Локальная разработка без Docker
### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Для локальной frontend-разработки держи `Node.js 22 LTS`.
Файл-подсказка:
- `/Users/pro/Desktop/ЗАВЕРШЕННЫЕ ПРОЕКТЫ/bot_mediaSD/web_app/frontend/.nvmrc`

## Push/PWA
Для web push в `.env` и `.env.example` добавлены:

```bash
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@serveone.local
```

После запуска:
- открой `/dashboard/settings`
- разреши уведомления браузеру
- включи push на текущем устройстве
- проверь кнопкой `Отправить тестовое уведомление`

## Следующий этап
- финальная ручная проверка production-сценария на сервере
- при желании — переход с `eslint 8` на `eslint 9`
