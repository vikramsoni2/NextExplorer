# Overview

nextExplorer is packaged as a single Docker image that hosts both the API/backend (Express + SQLite + thumbnail/search workers) and the Vite-built frontend. This page walks you through the pieces you need to start it, what configuration matters early, and what happens on first launch.

## What you need

- **Docker Engine 24+ & Docker Compose v2.** The official image targets modern platforms; use the Compose workflow shown below for reproducibility.
- **Host folders to expose as volumes.** Every `/host/path:/mnt/Label` mount becomes a top-level volume in the UI. Keep the folder readable by the container user (use `PUID`/`PGID` to match the host if needed).
- **Persistent config storage.** Mount a directory to `/config` so SQLite, `app-config.json`, extensions, and the generated session secret survive upgrades. Back this directory up before major changes.
- **Optional cache storage.** Thumbnails, search indexes, and temporary files go into `/cache`; it can be cleared safely when troubleshooting.

## Sample Docker Compose (production focused)

```yaml
services:
  nextexplorer:
    image: nxzai/explorer:latest
    container_name: nextexplorer
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PUBLIC_URL=http://localhost:3000
      # Optional: lock sessions to a known secret
      # - SESSION_SECRET=please-change-me
      # Optional host UID/GID mapping
      # - PUID=1000
      # - PGID=1000
    volumes:
      - /srv/nextexplorer/config:/config
      - /srv/nextexplorer/cache:/cache
      - /srv/data/Projects:/mnt/Projects
      - /srv/data/Downloads:/mnt/Downloads
```

> The image bundles the frontend assets and backend together, so routing, search, thumbnails, OnlyOffice, and OIDC endpoints are all served from `localhost:3000` inside the container.

## Volume strategy

- **Each `/mnt/Label` mount becomes a sidebar volume.** Give folders human-friendly labels to avoid confusion, e.g., `/mnt/Projects`, `/mnt/Media`.
- **`/config`:** Stores the SQLite database, `app-config.json`, and any installed extensions/themes (see `backend/src/config/env.js` for how `CONFIG_DIR` can be overridden). Back this folder up before upgrades.
- **`/cache`:** Holds thumbnails, ripgrep indexes, and other ephemeral state; deleting it is safe but will trigger regrowth.
- **Permission tip:** The entrypoint chown’s `/config` and `/cache` to the container user (default `1000:1000`). Override with `PUID`/`PGID` for custom ownership.

## First run checklist

1. Apply `docker compose up -d` from the directory with your Compose file.
2. (Optional) Set `AUTH_ADMIN_EMAIL` + `AUTH_ADMIN_PASSWORD` to auto-create the first local admin on startup and skip the setup wizard.
3. Visit `http://localhost:3000` (or your `PUBLIC_URL`) to sign in.
4. Browse the Volumes sidebar and ensure each host mount is visible and readable.
5. (Optional) Toggle OIDC via environment variables if your organization uses an identity provider (see the Integrations section for Keycloak, Authentik, and Authelia guides).

## Signing in

- **Local accounts:** Use the username/password created during setup; additional local users can be added from Settings → Admin.
- **OIDC SSO:** When `OIDC_ENABLED` and related variables are configured, a “Continue with Single Sign-On” button appears. The backend exposes `/login`, `/callback`, and `/logout` via Express OpenID Connect.

## Keeping the stack updated

```bash
docker compose pull
docker compose up -d
```

Persistent state lives under your `/config` mount (`app.db`, `app-config.json`, extensions) while `/cache` can be rebuilt. After pulling an image, verify the entrypoint remaps any legacy `/cache` configs to `/config` and restart the service.

## What’s next

- Explore the **Visual Tour** to see the UI layout and controls.
- Read the **Experience** section for workflows (browsing, uploads, search, editor).
- Dive into **Installation** for reverse proxy tips and networking.
- Visit **Configuration** to understand every environment variable and Settings section.
- Check **Integrations** when adding OIDC or ONLYOFFICE.
