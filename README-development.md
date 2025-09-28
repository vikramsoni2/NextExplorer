# Development Guide

This document covers local development, testing, and release workflows for nextExplorer. For user-facing deployment instructions, see `README.md`.

## Project Layout
- `frontend/` – Vue 3 + Vite SPA (Pinia, TailwindCSS).
- `backend/` – Express server exposing the file-system API, thumbnail generation, uploads, and terminal bridge.
- `Dockerfile` – Multi-stage build that bakes the frontend into the backend image.
- `docker-compose.yml` – Two-service stack for running frontend and backend with live reload.
- `docker-compose.fullstack.yml` – Single container that ships the production bundle.

## Prerequisites
- Node.js 18 or later and npm 9 or later.
- FFmpeg installed locally (the Docker image installs it automatically).
- Docker Desktop / Docker Engine + Compose v2 if you plan to build or run containers.
- macOS/Linux with file-system permissions to mount your working directories under `/mnt` and `/cache`.

## Local Setup

### Backend API
```bash
cd backend
npm install
npm start
```

- `npm start` runs `nodemon app.js` and restarts on code changes.
- Environment variables:
  - `PORT` (default `3000`)
  - `VOLUME_ROOT` (default `/mnt`)
  - `CACHE_DIR` (default `/cache`, thumbnails in `${CACHE_DIR}/thumbnails`)
- Ensure the process user can read/write the directories pointed to by `VOLUME_ROOT` and `CACHE_DIR`.

### Frontend SPA
```bash
cd frontend
npm install
cp .env.example .env  # adjust VITE_API_URL if the backend runs on a different host/port
npm run dev
```

- Dev server runs on `http://localhost:5173` with hot-module replacement.
- Helpful scripts:
  - `npm run build` – production bundle.
  - `npm run preview` – serve the built assets locally.
  - `npm run test:unit` – Vitest unit suite.
  - `npm run lint` – ESLint with Vue plugin; auto-fixes where possible.

### Full-stack Docker (development targets)
The default `docker-compose.yml` spins up both services with live mounts:
```bash
docker compose up --build
```
- Update the host volume paths under the `backend` service to match directories you want to expose.
- The frontend is available at `http://localhost:5173`, the backend at `http://localhost:3000`.
- Commented `node_modules` volumes are handy if you run into permission issues.

## Testing & Quality
- Frontend unit tests: `cd frontend && npm run test:unit`.
- Frontend lint: `cd frontend && npm run lint` (expect a few legacy warnings that still need cleanup).
- Backend currently has no automated tests; consider adding Vitest or Jest when introducing new API surface.

## Building Production Images
The multi-stage `Dockerfile` builds the Vue app and packages it with the Node backend.

### Local build
```bash
docker build -t nextexplorer:dev .
```

### Multi-architecture build & push
```bash
docker buildx create --use --name multi || docker buildx use multi
# Install QEMU binfmt for cross-compilation (one-time per host)
docker run --privileged --rm tonistiigi/binfmt --install all

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t nxzai/explorer:latest \
  --push .
```

## Release Checklist
- Update `README.md` screenshots or feature descriptions if UX changes.
- Regenerate the frontend production build (`npm run build`) and smoke-test locally.
- Run through critical file operations (upload/move/delete) on a staging instance.
- Bump Docker tags or package versions as needed and publish release notes.
