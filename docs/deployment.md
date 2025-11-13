# Self-Host with Docker Compose

### 1. Prerequisites
- Docker Engine 24+ and Docker Compose v2.
- Host directories that you want to expose to the explorer.
- A writable config directory for settings and the SQLite database (back this up).
- Optional cache mounts for thumbnails, indexes, and diagnostics.

### 2. Prepare host folders
Create or pick folders you plan to mount, for example:
- `/srv/nextexplorer/config` for the SQLite DB, `app-config.json`, and extensions.
- `/srv/nextexplorer/cache` for generated thumbnails and search indexes that can be cleared.
- `/srv/data/Projects` and `/srv/data/Downloads` for content you want to browse.
Ensure the Docker user has read/write permissions to each directory.

If you previously mounted `/srv/nextexplorer/cache` to `/cache`, remap that same host folder to `/config` instead. On first start the entrypoint moves the database/config files into `/config` and leaves compatibility links under `/cache`, so older deployments keep working.

### 3. Compose file
Create `docker-compose.yml` alongside your other infrastructure files:

```yaml
services:
  nextexplorer:
    image: nxzai/explorer:latest
    container_name: nextexplorer
    restart: unless-stopped
    ports:
      - "3000:3000"  # host:container
    environment:
      - NODE_ENV=production
      # Optional: match the container user/group to your host IDs
      # - PUID=1000
      # - PGID=1000
    volumes:
      - /srv/nextexplorer/config:/config
      - /srv/nextexplorer/cache:/cache
      - /srv/data/Projects:/mnt/Projects
      - /srv/data/Downloads:/mnt/Downloads
```

Every folder you mount under `/mnt` becomes a top-level volume inside the app. Add as many as you need by repeating the `/path/on/host:/mnt/Label` pattern.

### 4. Launch
Run the stack from the directory containing your Compose file:

```bash
docker compose up -d
```

The API and UI are both served on `http://localhost:3000`.

> **Upgrade note:** The entrypoint moves `app.db`, `app-config.json`, and similar config files from `/cache` into `/config` on first run, leaving symlinks under `/cache` so legacy mounts keep working.

### 5. Map container user IDs (recommended)
1. On the host, run `id -u` and `id -g` to capture your user and group IDs.
2. Set the `PUID` and `PGID` environment variables in your Compose file so the container runs as your user.
3. Restart the stack; any files created through nextExplorer will now be owned by your user on the host.

### 6. First-run setup
1. Open the app in your browser.
2. Set a password when prompted; this gate protects all future sessions.
3. Browse the Volumes panel to verify each mount shows up as expected.
4. Start uploading or editing files—thumbnails will populate the cache automatically.

### 7. Updating
To pull the latest release:

```bash
docker compose pull
docker compose up -d
```

Persistent state is stored under `/config`; `/cache` is safe to clear as it only holds thumbnails and temporary indexes. The container never mutates your data volumes under `/mnt` unless you take action in the UI.
