# IPTV Player Monorepo

This project is split into two folders:

- `backend/`: FastAPI API for playlist loading and health checks
- `frontend/`: React + Vite app for the IPTV UI

The root `main.py` is kept as a compatibility wrapper for the backend package.

## Structure

```text
backend/
  main.py
  requirements.txt
frontend/
  index.html
  package.json
  vite.config.js
  src/
    App.jsx
    main.jsx
    styles.css
main.py
Procfile
render.yaml
requirements.txt
```

## Backend

The backend exposes:

- `GET /api/health`
- `POST /api/playlist/load`

Run it locally:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Frontend

The frontend is a React + Vite app.

Run it locally:

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to `http://localhost:8000`.

If you deploy the frontend separately, set:

```bash
VITE_API_BASE_URL=https://your-backend-url
```

## Render Deployment

The Render backend service is configured to run the API:

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/api/health`

The Render frontend service is configured as a static site:

- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://iptv-player-wagl.onrender.com`

The frontend uses `VITE_API_BASE_URL` in production and `/api` proxying during local development.

## Notes

- The React app includes HLS playback with `hls.js`.
- Android landscape mode exposes the FIT/STR toggle and zoom controls.
- The backend parser trims large playlists to keep responses reasonable.
