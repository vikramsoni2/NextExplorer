# Getting Started

This guide walks you through prerequisites, first run, and common setup patterns.

Prerequisites

- Docker Engine 24+ and Docker Compose v2
- Host folders you plan to browse (mounted into the container)
- A writable cache directory for settings and thumbnails (SSD recommended)

Compose example

```yaml
services:
  nextexplorer:
    image: nxzai/explorer:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PUBLIC_URL=http://localhost:3000
      # Optional: override the auto-generated session secret
      # - SESSION_SECRET=please-change-me
      # Optional: run as your host UID/GID
      # - PUID=1000
      # - PGID=1000
    volumes:
      - /srv/nextexplorer/cache:/cache
      - /srv/data/Projects:/mnt/Projects
      - /srv/data/Downloads:/mnt/Downloads
```

Volumes

- Every folder you mount under `/mnt` appears as a top‑level volume in the sidebar
- Add as many volumes as you want using `/host/path:/mnt/Label`
- The `/cache` mount persists settings, user database, and thumbnails

First run

1. Start the stack: `docker compose up -d`
2. Open `http://localhost:3000`
3. Create the first local admin account on the Setup screen
4. Browse the Volumes panel; confirm mounts appear and are readable
5. Optional: Configure OIDC if your organization uses SSO (see Authentication)

Sign‑in options

- Local users: username/password you created on first run
- OIDC SSO: if enabled, use the “Continue with Single Sign‑On” button. The backend exposes `/login` and `/logout` via Express OpenID Connect.

Updating the container

```bash
docker compose pull
docker compose up -d
```

The app stores settings and thumbnails under `/cache`. Keep this volume mounted to preserve state across upgrades.
