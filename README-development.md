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

- `npm start` runs `node --watch app.js` to reload automatically on backend changes.
- Environment variables:
  - `PORT` (default `3000`)
  - `VOLUME_ROOT` (default `/mnt`)
  - `CACHE_DIR` (default `/cache`, thumbnails in `${CACHE_DIR}/thumbnails`)
  - `LOG_LEVEL` (default `info`; set to `debug` for verbose logs). Setting `DEBUG=true` implicitly selects `LOG_LEVEL=debug`.
  - OIDC (provider-agnostic) via Express OpenID Connect (EOC):
    - `PUBLIC_URL` – required for correct callback/base URL when using EOC
    - `OIDC_ENABLED` – `true` to enable OIDC
    - `OIDC_ISSUER` – provider issuer URL (Keycloak realm URL, Authentik issuer, Authelia issuer)
    - `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET`
    - `OIDC_SCOPES` – e.g. `openid profile email` (add `groups` if your provider supports it)
    - `SESSION_SECRET` – optional; if omitted the backend generates a strong secret at startup (used for sessions and EOC cookies)
    - Optional overrides: `OIDC_AUTHORIZATION_URL`, `OIDC_TOKEN_URL`, `OIDC_USERINFO_URL`, `OIDC_CALLBACK_URL`
  - Feature flags:
    - `FEATURE_VOLUME_USAGE` – `true` to enable volume usage progress bar and used/total labels on the Volumes page. Defaults to `false`.

When EOC is enabled, the backend exposes default OIDC routes:
- `GET /login` – start login
- `GET /callback` – OIDC callback (configure this in your provider)
- `GET /logout` – logout (IdP logout enabled)

For backward compatibility with the UI, the wrapper route `GET /api/auth/oidc/login` also triggers EOC login when available.
- Ensure the process user can read/write the directories pointed to by `VOLUME_ROOT` and `CACHE_DIR`.

### Frontend SPA
```bash
cd frontend
npm install
cp .env.example .env  # when using the proxy flow, leave VITE_API_URL unset
npm run dev
```

- Dev server runs on `http://localhost:3000` with hot-module replacement.
- Build metadata for About page (optional): set these before `npm run build` (or in `.env`) to show git info:
  - `VITE_GIT_COMMIT` – full SHA (e.g. `$(git rev-parse HEAD)`)
  - `VITE_GIT_BRANCH` – branch name
  - `VITE_REPO_URL` – repository URL (e.g. `https://github.com/owner/repo`)
- Helpful scripts:
  - `npm run build` – production bundle.
  - `npm run preview` – serve the built assets locally.
  - `npm run test:unit` – Vitest unit suite.
  - `npm run lint` – ESLint with Vue plugin; auto-fixes where possible.

### Single-port Dev via Vite proxy (recommended)
Serve the SPA on port 3000 and proxy API calls to the backend on an internal port 3001.

Local (no Docker):
```bash
# Backend on 3001
cd backend && npm ci
PORT=3001 VOLUME_ROOT=$PWD/../example-express-openid CACHE_DIR=$PWD/.cache npm run start

# Frontend on 3000 (proxies /api and /static/thumbnails to 3001)
cd ../frontend && npm ci
VITE_BACKEND_ORIGIN=http://localhost:3001 npm run dev
# Open http://localhost:3000
```

Docker (two services, one exposed port):
```bash
docker compose -f docker-compose.dev.yml up --build
```
- Only `http://localhost:3000` is exposed; backend listens on 3001 internally.
- Update the host volume paths under the `backend` service to match directories you want to expose.

If you run the dev stack behind a local reverse proxy, set `PUBLIC_URL` for the backend to the proxy URL (defaults to `http://localhost:3000` in `docker-compose.dev.yml`). This centralizes:
- CORS origin (derived from the origin of `PUBLIC_URL` unless `CORS_ORIGINS` is set)
- OIDC callback URL (defaults to `PUBLIC_URL + /api/auth/oidc/callback` unless `OIDC_CALLBACK_URL` is set)

Note: When using EOC, prefer setting your provider redirect URI to `${PUBLIC_URL}/callback` (the EOC default). The legacy Passport OIDC flow still supports `${PUBLIC_URL}/api/auth/oidc/callback`.

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
