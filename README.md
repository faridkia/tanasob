# Tanasob Smart Gym Management System

A university capstone project for managing gym memberships, classes, bookings,
workout and diet plans, body progress, messaging, notifications, and reports.

## Project structure

```text
backend/   Django + Django REST Framework API
frontend/  Reserved for the React application
```

## Run the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py seed
python manage.py runserver
```

Swagger UI is available at `http://127.0.0.1:8000/api/docs/`.

The seed command creates Persian demo data. Example credentials:

- Admin: `admin@tanasob.ir` / `admin123`
- Trainer: `parisa@tanasob.ir` / `trainer123`
- Member: `ali.rezaei@tanasob.ir` / `member123`

## Security

Do not commit `.env`, `db.sqlite3`, private keys, or real credentials. The
repository includes `.env.example` as a safe configuration template.

## Run with Docker

```bash
cp backend/.env.example backend/.env   # fill in AI_LLM_* to enable the AI chat
docker compose build
docker compose up -d
```

- App: `http://<server>:30080/` (frontend; proxies `/api/`, `/admin/` and
  `/static/` to the backend container, so this is the only port that needs
  to be reachable)
- API directly: `http://<server>:30081/api/docs/`

Ports are `30080`/`30081` on purpose — pick different ones in
`docker-compose.yml` if those are also taken. The backend image ships with
the current `db.sqlite3` (seed data included, see login credentials above)
baked in at build time; it is not persisted across `docker compose build`
rebuilds.

## Run the frontend

In a second terminal, after starting the Django backend:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The Vite proxy forwards API requests to the
local Django server.
