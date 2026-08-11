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
