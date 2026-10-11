# Aurevia

Fashion jewellery & gifting store for Indian customers: storefront, separate admin panel and a FastAPI backend.

| Part | Folder | Tech | Local URL |
|---|---|---|---|
| Storefront | `frontend/` | React (Create React App), Tailwind | http://localhost:3000 |
| Admin panel | `admin/` | React (Vite), Tailwind | http://localhost:3001 |
| API | `backend/` | FastAPI, MongoDB (Motor) | http://127.0.0.1:8000 (docs at `/docs`) |

## Run locally

```bash
# 1. Backend
cd backend
cp .env.example .env        # then edit values
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8000 --reload

# 2. Storefront (new terminal)
cd frontend && npm install && npm start

# 3. Admin (new terminal)
cd admin && npm install && npm run dev
```

Both frontends proxy `/api` and `/uploads` to the backend in development, so auth cookies stay same-origin.

Without a real `MONGO_URL` the backend uses an **in-memory database** (data resets on restart) and seeds the demo catalogue, slides, categories and offers.

## Admin access

Set `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `backend/.env`; the account is created on first start.
