# Deployment

Deploy nextExplorer via Docker Compose for reproducible self-hosted workflows. This guide outlines the folders, networking, and procedures you’ll rely on for production-ready setups.

## Prerequisites

- **Docker Engine 24+ and Docker Compose v2** (or later). The official image depends on modern orchestration features.
- **Host directories** for data volumes, `/config`, and optional `/cache` (make sure the Docker user can read/write these paths).
- **TLS-capable reverse proxy** if you need HTTPS, custom domains, or sticky sessions.

## Host folder layout

| Purpose                            | Container path                                | Notes                                                                                                 |
| ---------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Configuration, user DB, extensions | `/config`                                     | Holds SQLite, `app-config.json`, and upgrades. Back this directory up before changes.                 |
| Thumbnail/search cache             | `/cache`                                      | Regenerable; safe to delete when troubleshooting.                                                     |
| Browsable data                     | `/mnt/Label`                                  | Each mount appears as a top-level volume with the given label.                                        |
| Personal user data (optional)      | `/srv/users` (or any path set as `USER_ROOT`) | When `USER_DIR_ENABLED=true`, each authenticated user gets their own private folder inside this root. |

## Production compose example

```yaml
services:
  nextexplorer:
    image: nxzai/explorer:latest
    container_name: nextexplorer
    restart: unless-stopped
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - PUBLIC_URL=https://files.example.com
      - SESSION_SECRET=please-change-me
      - PUID=1000
      - PGID=1000
      # Enable per-user "My Files" home folders
      - USER_DIR_ENABLED=true
      - USER_ROOT=/srv/nextexplorer/users
    volumes:
      - /srv/nextexplorer/config:/config
      - /srv/nextexplorer/cache:/cache
      - /srv/data/Projects:/mnt/Projects
      - /srv/data/Media:/mnt/Media
      # Personal home folders (one subfolder per user)
      - /srv/nextexplorer/users:/srv/nextexplorer/users
```

- `PUBLIC_URL` informs the backend's cookie settings, CORS, and default OIDC callback (see `backend/src/config/env.js`).
- `SESSION_SECRET` ensures sessions persist across restarts; without it, the app generates a random secret each time.
- Optional first-run bootstrap: set `AUTH_ADMIN_EMAIL` and `AUTH_ADMIN_PASSWORD` to auto-create the first local admin on startup (skips the setup wizard).

## Launching and validating

1. Run `docker compose up -d` from the folder containing your Compose file.
2. Visit `http://localhost:3000` (or your `PUBLIC_URL`) and sign in (or, if you didn’t set `AUTH_ADMIN_*`, finish the setup wizard to create the first local admin).
3. Revisit Settings to adjust thumbnails, access control, and users.
4. Confirm each `Label` shows up in the sidebar and that you can browse/upload files.

## Managing updates

```bash
docker compose pull
docker compose up -d
```

- Persistent state (`app.db`, `app-config.json`, extensions) stays inside `/config`. Always back this up before major upgrades.
- The default entrypoint moves legacy config files from `/cache` to `/config` on first run; keep `/config` mounted to avoid data loss.

## Monitoring & logs

- Use `LOG_LEVEL`, `DEBUG`, and `ENABLE_HTTP_LOGGING` (from `backend/src/config/env.js`) to tune logging verbosity.
- The container writes logs to stdout/stderr; stitch them together with your orchestrator (Docker logs, systemd, etc.).
