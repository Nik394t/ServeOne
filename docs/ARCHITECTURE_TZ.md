# ServeOne Web App — Архитектурное ТЗ

## 1. Цель проекта
Создать самостоятельное веб-приложение для управления медиа-служением с современным строгим интерфейсом, без зависимости от Telegram. Приложение должно одинаково корректно работать на компьютерах, планшетах и телефонах, поддерживать роли, авторизацию, push-уведомления, установку на рабочий стол как PWA и покрывать весь функционал действующей системы.

## 2. Границы проекта
- Исходный бот не изменяется.
- Логика текущей системы используется как источник требований.
- Новый продукт разрабатывается отдельно в папке `web_app`.
- На первом этапе продукт должен работать как веб-приложение и PWA.

## 3. Рабочая структура репозитория
- `web_app/frontend` — клиентская часть.
- `web_app/backend` — API и бизнес-логика.
- `web_app/infra` — docker, deploy, nginx, backup, env templates.
- `web_app/docs` — ТЗ, архитектура, API-контракты, схемы БД.
- `web_app/.github/workflows` — CI/CD.

## 4. Технологический стек
- Frontend: `Next.js`, `TypeScript`, `Tailwind CSS`, `shadcn/ui` как база компонентов с кастомизацией под строгий фирменный стиль.
- State/Data: `TanStack Query`, `Zustand`.
- Forms/validation: `react-hook-form`, `zod`.
- PWA: `next-pwa` или эквивалентная интеграция.
- Backend: `FastAPI`, `SQLAlchemy`, `Alembic`, `Pydantic`.
- Database: `PostgreSQL`.
- Auth: JWT access token + refresh token.
- Notifications: Web Push.
- Infra: `Docker`, `docker compose`, GitHub Actions.

## 5. Роли и права
### 5.1 Creator
Полные права системы.
- создаёт админов и обычных пользователей
- повышает и понижает админов
- управляет всеми модулями
- управляет системными настройками
- управляет seed-настройками и критическими параметрами
- видит аудит и полную историю

### 5.2 Admin
Операционный администратор.
- создаёт только обычных пользователей
- редактирует пользователей
- не может назначать админов
- управляет инструктажами
- управляет ротацией
- управляет рассылками
- управляет днями рождения
- управляет служениями, напарниками, дежурствами
- видит отчёты и историю

### 5.3 User
Обычный участник.
- видит свои назначения
- видит свои инструктажи и чек-листы
- подтверждает участие
- получает уведомления
- пишет админу
- редактирует только свой профиль и личные настройки

## 6. Первый пользователь
Первый пользователь создаётся автоматически при первом запуске через seed-скрипт.
- login: `Nikki394t`
- password: `Tfz+3940`
- role: `creator`

Требование реализации:
- пароль хранится только в виде hash
- исходные значения задаются через env/init script
- в базе не хранится plain text пароль

## 7. Функциональные модули
### 7.1 Авторизация и профиль
- вход по логину и паролю
- `Запомнить меня`
- выход из системы
- смена пароля
- редактирование профиля
- управление push-разрешением
- установка приложения на устройство

### 7.2 Пользователи
- список пользователей
- поиск и фильтрация
- создание пользователя
- редактирование профиля пользователя
- смена роли по правилам доступа
- деактивация
- удаление
- настройка индивидуальных уведомлений

### 7.3 Служения и ротация
- ближайшее служение
- позиции на неделю
- автоматическая ротация
- ручная корректировка ротации
- фиксация человека на позиции на N служений
- напарники
- ручное назначение, замена, освобождение позиции
- сценарий “человек без позиции” с выбором решения админом
- история изменений ротации

### 7.4 Дежурства по коморке
- участники очереди
- текущий дежурный
- ручной сдвиг очереди
- автосдвиг по понедельникам
- история сдвигов

### 7.5 Инструктажи и чек-листы
- инструкции по позициям
- медиа-материалы: фото, текст, ссылки
- чек-лист по позиции
- отметка выполнения
- прогресс по текущему служению
- редактирование инструкций администраторами

### 7.6 Рассылки
- массовая рассылка
- персональная отправка
- выбор получателей
- исключения по пользователям
- шаблоны сообщений
- аудит отправок

### 7.7 Дни рождения
- список дней рождения
- шаблоны поздравлений
- поздравления без повторов
- ручной запуск поздравления
- модуль “сбор на подарок”
- выбор именинника
- выбор исключений получателей
- выбор формулировки “брат/сестра”

### 7.8 Подтверждения участия
- пользователь получает запрос участия
- подтверждает: буду / не буду / заболел
- админ видит сводку ответов
- история подтверждений хранится

### 7.9 Коммуникация с админами
- пользователь может написать админу
- выбор конкретного администратора
- админ может ответить пользователю
- история обращений

### 7.10 Отчёты и история
- кто где служил
- статистика по служениям
- история назначений
- история уведомлений
- аудит действий админов и creator

## 8. Архитектура frontend
### 8.1 Общая структура
- `app/(public)` — экран входа
- `app/(private)` — защищённая часть
- `app/(private)/dashboard` — главная
- `app/(private)/schedule` — служения и ротация
- `app/(private)/duty` — дежурства
- `app/(private)/instructions` — инструктажи
- `app/(private)/birthdays` — дни рождения
- `app/(private)/broadcasts` — рассылки
- `app/(private)/users` — участники
- `app/(private)/reports` — отчёты
- `app/(private)/messages` — переписка
- `app/(private)/settings` — настройки
- `components/ui` — базовые UI-компоненты
- `components/layout` — shell, nav, headers, drawers
- `components/domain/*` — бизнес-компоненты по модулям
- `lib/api` — клиент API
- `lib/auth` — токены, guards, session
- `lib/pwa` — install, service worker hooks, push
- `store` — клиентские store

### 8.2 Навигация
Desktop:
- слева sidebar
- сверху top bar
- справа contextual panel по месту

Tablet:
- сворачиваемый sidebar
- адаптивная сетка 2/1 колонка

Mobile:
- нижняя navigation bar
- sticky page header
- карточные представления вместо широких таблиц

### 8.3 Правила адаптивности
- mobile-first
- breakpoint-система минимум: `360`, `480`, `768`, `1024`, `1280`, `1536`
- размеры шрифтов и элементов через fluid scale
- таблицы на мобильном превращаются в карточки
- secondary actions уезжают в bottom sheet или overflow menu
- tap targets не меньше `44x44`

### 8.4 Основные экраны
#### Экран входа
- логин
- пароль
- запомнить меня
- показать/скрыть пароль
- состояние загрузки
- ошибки авторизации

#### Главная
- карточка ближайшего служения
- моя позиция / мой статус
- быстрые действия
- уведомления
- незавершённые чек-листы

#### Ротация
- вид недели
- позиции и пользователи
- напарники
- holds на N служений
- нераспределённые люди
- массовые действия
- история изменений

#### Участники
- таблица / карточки
- фильтр по роли
- фильтр по активности
- редактирование пользователя
- удаление пользователя
- роль, уведомления, контактные данные

#### Инструктажи
- список позиций
- содержимое инструкции
- редактор блоков
- медиа-вложения
- чек-лист

#### Рассылки
- список шаблонов
- composer
- предпросмотр
- выбор получателей
- журнал отправок

#### Настройки
- профиль
- безопасность
- уведомления
- установка приложения
- управление push
- темы интерфейса

## 9. Архитектура backend
### 9.1 Слои
- `api` — роуты
- `schemas` — pydantic DTO
- `services` — бизнес-логика
- `repositories` — доступ к данным
- `models` — SQLAlchemy модели
- `core` — settings, auth, security, logging
- `jobs` — фоновые задачи
- `migrations` — Alembic

### 9.2 Backend-структура
- `backend/app/main.py`
- `backend/app/api/v1/...`
- `backend/app/models/...`
- `backend/app/services/...`
- `backend/app/repositories/...`
- `backend/app/core/...`
- `backend/app/jobs/...`
- `backend/alembic/...`
- `backend/scripts/init_creator.py`

## 10. Высокоуровневая модель данных
### 10.1 Таблицы пользователей
- `users`
- `roles`
- `user_sessions`
- `push_subscriptions`

### 10.2 Таблицы служений
- `services`
- `positions`
- `service_assignments`
- `assignment_partners`
- `assignment_holds`
- `service_progress`
- `service_history`

### 10.3 Таблицы дежурств
- `duty_members`
- `duty_queue`
- `duty_history`

### 10.4 Таблицы коммуникаций
- `broadcasts`
- `broadcast_recipients`
- `messages`
- `message_threads`
- `notifications`

### 10.5 Таблицы birthday-модуля
- `birthdays`
- `birthday_templates`
- `birthday_delivery_log`
- `gift_collection_campaigns`
- `gift_collection_exclusions`

### 10.6 Таблицы инструктажей
- `instruction_sections`
- `instruction_items`
- `instruction_assets`
- `checklist_templates`
- `checklist_progress`

### 10.7 Таблицы системных настроек и аудита
- `system_settings`
- `audit_log`

## 11. API-контракты уровня модулей
### 11.1 Auth API
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/change-password`

### 11.2 Users API
- `GET /api/v1/users`
- `POST /api/v1/users`
- `GET /api/v1/users/{id}`
- `PATCH /api/v1/users/{id}`
- `DELETE /api/v1/users/{id}`
- `POST /api/v1/users/{id}/deactivate`
- `POST /api/v1/users/{id}/role`
- `POST /api/v1/users/{id}/notification-settings`

### 11.3 Services/Rotation API
- `GET /api/v1/services/current`
- `GET /api/v1/services/upcoming`
- `GET /api/v1/rotation/weeks/{weekId}`
- `POST /api/v1/rotation/generate`
- `PATCH /api/v1/rotation/assignments/{id}`
- `POST /api/v1/rotation/assignments/{id}/partner`
- `POST /api/v1/rotation/holds`
- `PATCH /api/v1/rotation/holds/{id}`
- `DELETE /api/v1/rotation/holds/{id}`
- `GET /api/v1/rotation/unassigned`
- `POST /api/v1/rotation/unassigned/{userId}/assign`
- `POST /api/v1/rotation/unassigned/{userId}/rest`

### 11.4 Duty API
- `GET /api/v1/duty`
- `POST /api/v1/duty/members`
- `DELETE /api/v1/duty/members/{userId}`
- `POST /api/v1/duty/advance`
- `GET /api/v1/duty/history`

### 11.5 Instructions API
- `GET /api/v1/instructions`
- `GET /api/v1/instructions/{position}`
- `PATCH /api/v1/instructions/{position}`
- `POST /api/v1/instructions/{position}/assets`
- `DELETE /api/v1/instructions/assets/{assetId}`
- `POST /api/v1/checklists/progress`
- `GET /api/v1/checklists/me`

### 11.6 RSVP API
- `GET /api/v1/rsvp/current`
- `POST /api/v1/rsvp/respond`
- `GET /api/v1/rsvp/overview`

### 11.7 Broadcast API
- `GET /api/v1/broadcasts`
- `POST /api/v1/broadcasts`
- `GET /api/v1/broadcasts/{id}`
- `POST /api/v1/broadcasts/{id}/send`
- `GET /api/v1/broadcasts/{id}/recipients`
- `POST /api/v1/broadcasts/templates`

### 11.8 Birthdays API
- `GET /api/v1/birthdays`
- `POST /api/v1/birthdays`
- `PATCH /api/v1/birthdays/{id}`
- `DELETE /api/v1/birthdays/{id}`
- `GET /api/v1/birthday-templates`
- `POST /api/v1/birthday-campaigns`
- `POST /api/v1/birthday-campaigns/{id}/send`

### 11.9 Messaging API
- `GET /api/v1/messages/threads`
- `GET /api/v1/messages/threads/{id}`
- `POST /api/v1/messages/threads`
- `POST /api/v1/messages/threads/{id}/reply`

### 11.10 Notifications/PWA API
- `POST /api/v1/push/subscribe`
- `DELETE /api/v1/push/subscribe`
- `POST /api/v1/push/test`
- `GET /api/v1/notifications`
- `POST /api/v1/notifications/{id}/read`

### 11.11 Reports API
- `GET /api/v1/reports/service-history`
- `GET /api/v1/reports/service-stats`
- `GET /api/v1/reports/rsvp`
- `GET /api/v1/reports/audit-log`

## 12. Бизнес-правила, которые надо зафиксировать в backend
1. Admin не может назначать Admin.
2. Только Creator может менять роль до Admin.
3. Удаление пользователя не удаляет исторические записи из отчётов.
4. Hold позиции работает на N служений и уменьшается после завершённого служения.
5. Пока hold активен, ротация не трогает этого человека.
6. Если у человека нет позиции перед рассылкой, система не шлёт автоматически “выходной”, пока админ не примет решение.
7. Очередь дежурств сдвигается автоматически раз в понедельник.
8. Все критические операции пишутся в аудит.

## 13. Push и PWA
### 13.1 Требования
- web manifest
- service worker
- offline shell для базового открытия
- install prompt
- standalone launch
- push subscriptions на пользователя

### 13.2 Ограничения
- кнопка “Установить приложение” не создаёт ярлык вручную, а запускает нативный PWA install flow браузера
- поведение зависит от платформы и браузера

## 14. Безопасность
- hash passwords через `argon2` или `bcrypt`
- refresh token rotation
- httpOnly cookies для refresh token, если выберем cookie-based flow
- CSRF защита для cookie-based сценария
- rate limit на login
- аудит входов
- блокировка опасных действий по ролям

## 15. CI/CD и GitHub
### 15.1 Репозиторий
Один GitHub-репозиторий с папкой `web_app`.

### 15.2 Pipelines
- lint frontend/backend
- typecheck frontend/backend
- tests frontend/backend
- build docker images
- deploy to staging
- manual deploy to production

## 16. Этапы реализации
### Этап 1
- создать каркас `frontend` и `backend`
- поднять docker compose
- подключить PostgreSQL
- настроить env и CI

### Этап 2
- реализовать auth
- seed creator
- remember me
- роли и guards

### Этап 3
- сделать layout и дизайн-систему
- адаптивный shell
- темы

### Этап 4
- реализовать пользователей и роли
- CRUD пользователей
- разграничение прав

### Этап 5
- реализовать служения, ротацию, holds, partners
- реализовать бизнес-правила распределения

### Этап 6
- реализовать дежурства
- автосдвиг
- историю очереди

### Этап 7
- реализовать инструктажи и чек-листы

### Этап 8
- реализовать рассылки, birthdays, gift collection, сообщения

### Этап 9
- реализовать push, PWA, install flow

### Этап 10
- отчёты, аудит, стабилизация, нагрузочные проверки, production deploy

## 17. Критерии готовности MVP
- авторизация работает
- Creator/Admin/User разграничены
- адаптивный UI работает на desktop/tablet/mobile
- есть назначения, ротация, дежурства, инструктажи, пользователи
- PWA устанавливается
- push-уведомления работают на поддерживаемых устройствах
- история не теряется между обновлениями

## 18. Следующий рабочий шаг
На следующем этапе нужно подготовить уже не ТЗ, а стартовую техническую структуру:
- `docker-compose.yml` для `web_app`
- каркас `Next.js`
- каркас `FastAPI`
- схему БД v1
- seed creator
- auth flow v1
