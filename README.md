# Kinematics Problem Suite

Платформа для решения задач по физике и математике: каталог «предмет → тема → задача», условия с формулами LaTeX, автопроверка числовых ответов с единицами измерения, ручная проверка учителем, статистика и рейтинг.

**Стек:** FastAPI + PostgreSQL (asyncpg, чистый SQL) · React 19 + TypeScript + Vite + Tailwind CSS 4 · Docker · GitHub Actions.

## Быстрый старт (Docker)

```bash
cp .env.example .env      # поменяйте пароли и SECRET_KEY
docker compose up --build
```

- Сайт: http://localhost:8080
- Админ-панель: http://localhost:8081 — вход под `ADMIN_USERNAME` / `ADMIN_PASSWORD` из `.env`.

Учителей назначает администратор в админ-панели («Пользователи») — при регистрации все получают роль «ученик».

Сайт и админ-панель — два отдельных приложения с отдельными Docker-образами. В продакшене выставляйте админку на свой домен (например `admin.example.tj`) и по возможности закрывайте по IP/VPN. Публичный nginx не пропускает запросы к `/api/admin/`.

## Разработка без Docker

```bash
# 1. База данных
docker compose -f docker-compose.dev.yml up -d

# 2. Бэкенд (Python 3.12+)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
export DATABASE_URL=postgresql://kinematics:kinematics@localhost:5432/kinematics
export SECRET_KEY=dev-secret-key-dev-secret-key-dev-secret
export ADMIN_USERNAME=admin ADMIN_PASSWORD=admin12345
uvicorn app.main:app_factory --factory --reload      # http://localhost:8000/docs

# 3. Фронтенд (Node 22): npm workspaces — сайт, админка и общий пакет
cd frontend
npm install
npm run dev                                           # сайт: http://localhost:5173
npm run dev:admin                                     # админка: http://localhost:5174
```

Миграции из `backend/app/migrations/*.sql` применяются автоматически при старте бэкенда.

## Тесты и проверки

```bash
# бэкенд: интеграционные тесты нужна отдельная база (её схема очищается!)
cd backend
createdb kinematics_test   # или через docker
TEST_DATABASE_URL=postgresql://kinematics:kinematics@localhost:5432/kinematics_test pytest
ruff check . && ruff format --check .

# фронтенд
cd frontend
npm run typecheck && npm test && npm run build
```

CI (`.github/workflows/ci.yml`) на каждый push и pull request: ruff + pytest с PostgreSQL, проверка типов + vitest + сборка фронтенда, сборка Docker-образов.

## Структура

```
backend/
  app/
    main.py            создание приложения, CORS, статика /uploads
    db.py              пул asyncpg и мини-мигратор
    migrations/        SQL-миграции (001_init.sql, …)
    security.py        bcrypt и JWT (access + refresh с ротацией)
    deps.py            текущий пользователь, проверка ролей
    modules/
      auth/            регистрация, вход, refresh, logout
      users/           профиль, аватар, админка пользователей
      content/         предметы, темы, задачи
      solutions/       попытки, автопроверка (checker.py), оценки учителя
      stats/           личная статистика и рейтинг
  tests/               pytest: юнит-тесты + интеграционные через HTTP
frontend/              npm workspaces
  packages/shared/     общий код: API-клиент, авторизация, тема, UI-кит,
                       Markdown-редактор, форма задачи, оценка решения
  apps/web/            публичный сайт (ученики и учителя)
  apps/admin/          админ-панель (только роль admin)
  nginx/               конфиги nginx для web и admin
  Dockerfile           --build-arg APP=web | admin
```

Админские методы API собраны в модуле `admin` под префиксом `/api/admin` и доступны только роли `admin`.

Каждый модуль бэкенда — это `queries.py` (только SQL-строки), `schemas.py` (Pydantic) и `router.py` (HTTP). Подробнее о решениях — в [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), план развития — в [docs/ROADMAP.md](docs/ROADMAP.md).

## Формат условий и ответов

- Условие — Markdown + LaTeX: `$v = s/t$` в строке, `$$a = \frac{v - v_0}{t}$$` отдельным блоком.
- Числовой ответ принимает `20`, `20,0`, `2e1`, `2·10^1`, `20 м/с`, `72 км/ч` (единицы переводятся). Погрешность задаётся в процентах.
- Текстовый ответ: несколько допустимых вариантов через `|`, регистр и «ё/е» не важны.
- Режим «Вручную»: ответ (и/или фото решения) уходит учителю на проверку.
