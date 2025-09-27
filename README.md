# nextExplorer

A full-stack file explorer that lets you browse host volumes, upload files or folders, generate thumbnails, and manage content (download, copy, move, delete) through a Vue 3 interface backed by an Express API.

## Project structure

- `frontend/` – Vue 3 + Vite app (Pinia, Tailwind) for the UI.
- `backend/` – Express server that exposes file system APIs, thumbnail generation, and file upload handling.
- `docker-compose.yml` – Spins up both services with volume mounts for browsing host directories.

## Prerequisites

- Node.js 18+ (for local development)
- npm 9+
- FFmpeg installed on the backend host (the Docker image installs it automatically)
- For Docker: Docker Engine + Compose v2

## Quick start with Docker Compose

1. Verify the host paths referenced in `docker-compose.yml` exist (or adjust them):
   - `/Users/vikram/projects`
   - `/Users/vikram/Downloads`
   - `/Users/vikram/Downloads/cache`
2. From the repository root run:

   ```bash
   docker compose up --build
   ```

3. Open the app at http://localhost:5173. The API runs on http://localhost:3000.

Mounted folders appear under the **Volumes** section. Thumbnail cache lives in `/Users/vikram/Downloads/cache` on the host.

## Running locally without Docker

### 1. Backend

```bash
cd backend
npm install
npm start
```

Environment variables (all optional):

- `PORT` (default `3000`)
- `VOLUME_ROOT` (default `/mnt`)
- `CACHE_DIR` (default `/cache`, thumbnails saved in `${CACHE_DIR}/thumbnails`)

Make sure the process has read/write access to `VOLUME_ROOT` and `CACHE_DIR`, and that FFmpeg is available in `PATH`.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # edit if the API server runs elsewhere
npm run dev
```

Key environment variable:

- `VITE_API_URL` – Base URL for the backend (defaults to `http://localhost:3000` if unset).
- `VITE_EDITOR_EXTENSIONS` – Comma-separated list of extensions that should open in the editor (defaults include txt, md, csv, json, js, ts, py, …).

The dev server runs on http://localhost:5173 by default.

## Core features

- Browse any directory exposed under `VOLUME_ROOT`
- Upload files or entire folders with progress feedback (Uppy + XHR)
- Automatic thumbnail generation for images and videos (cached on disk)
- Download individual files
- Copy, cut, paste between folders (unique-name handling + cross-volume support)
- Delete selected items
- Inline code editor for text-based files (Vue Codemirror)

## API highlights

| Method | Endpoint            | Description                               |
| ------ | ------------------- | ----------------------------------------- |
| POST   | `/api/upload`       | Upload files to the current directory     |
| GET    | `/api/browse/*`     | List directory contents                   |
| GET    | `/api/volumes`      | Enumerate top-level volumes               |
| GET    | `/api/download`     | Download a single file (?path=...)        |
| POST   | `/api/files/copy`   | Copy items to a destination folder        |
| POST   | `/api/files/move`   | Move (cut) items to a destination folder  |
| DELETE | `/api/files`        | Delete one or more items                  |
| POST   | `/api/editor`       | Read file content for the editor          |
| PUT    | `/api/editor`       | Persist file edits                        |

All filesystem paths are validated to stay within `VOLUME_ROOT`.

## Development notes

- The frontend build currently triggers a Tailwind v2 → v3 warning; update `tailwind.config.js` when refactoring styles.
- `npm run lint` in `frontend/` still reports legacy unused-code warnings in older components. The new features compile (`npm run build`) and the backend passes `node --check`.
- Thumbnail cache directories are created automatically on server startup.

## Next steps

- Surface better toast-style feedback for long-running copy/move/delete operations.
- Tidy remaining lint warnings by pruning unused scaffolding components.
- Add automated tests around the file-operations API.
