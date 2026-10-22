## How it was made?

The original project was my engineering thesis app. It's still working on https://simplefund.me/
<img width="70%" height="70%" alt="image" src="https://github.com/user-attachments/assets/01660052-b591-4abc-89eb-2f770c6b4a07" />

## Running the frontend locally

Install Node.js and npm, then run:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite (usually http://localhost:5173).

## Running the backend locally

Install Python 3.12 or newer and [uv](https://docs.astral.sh/uv/getting-started/installation/), then run:

```bash
cd backend
uv sync
```

Create `backend/.env` with your project's credentials:

```dotenv
DB_PASSWORD=your_database_password
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
```

Keep these credentials out of version control. From the `backend` directory, start the development server:

```bash
uv run uvicorn app.main:app --reload
```

The API runs at http://localhost:8000. Open http://localhost:8000/docs for interactive API documentation.

Apply database migrations from `backend` before using cash operations:

```bash
uv run alembic upgrade head
```

The Vite development server proxies `/api` to `http://127.0.0.1:8000`. For a deployed frontend, configure the same proxy or set `VITE_API_URL` to the backend's full API base URL, including `/api/v1`. If using a different origin, configure the backend's CORS allowlist too.

<img width="1693" height="1063" alt="image" src="https://github.com/user-attachments/assets/4d32f036-8212-49de-84d1-ed62cad26833" />
