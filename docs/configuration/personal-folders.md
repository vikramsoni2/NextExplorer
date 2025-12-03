# Personal user folders ("My Files")

nextExplorer can expose a **per-user home space** alongside your shared volumes. In the UI this appears as a separate entry labeled **“My Files”**, and it uses the same Folder View, search, favorites, editor, and ONLYOFFICE integrations as your other folders.

This section explains how it works and how to enable it.

## How personal folders work

- Each authenticated user gets a private directory under a common root (`USER_ROOT`).
- Logical paths for personal items always start with `personal/`:
  - Example: `personal`, `personal/photos`, `personal/docs/report.docx`.
- The backend maps those logical paths to the filesystem:
  - Volume paths: `Projects/file.txt` → `<VOLUME_ROOT>/Projects/file.txt`.
  - Personal paths: `personal/docs/file.txt` → `<USER_ROOT>/<userFolder>/docs/file.txt`.
- The `<userFolder>` name is derived from the user’s identity (id / username / email) and sanitized so it is safe as a directory name.
- Access control rules, favorites, search and previews work on the **logical** path:
  - You can define access rules for `personal/...` if you want to further restrict or hide parts of the personal tree.

On the frontend:

- When the feature is enabled the sidebar and Home screen show a translated **“My Files”** entry (`drives.personal` in i18n).
- Clicking it navigates to `/browse/personal`, which uses the existing Folder View UI and APIs.
- The standard **Share** workflow also works from within **My Files**: when you share items under `personal/...`, links resolve back to the owner’s personal folder while still respecting Access Control and share settings (read-only/read-write, password, expiration).

## Enabling personal folders

Personal folders are controlled entirely via environment variables on the backend.

### Required environment variables

In addition to your usual `VOLUME_ROOT`/`CONFIG_DIR`/`CACHE_DIR` settings, configure:

```yaml
USER_DIR_ENABLED=true
USER_ROOT=/srv/users
```

- `USER_DIR_ENABLED`:
  - Default: `false`.
  - When `true`, the backend exposes the `personal/` namespace and the frontend shows the “My Files” entry (via `/api/features`).
- `USER_ROOT`:
  - Default: `<VOLUME_ROOT>/_users` when unset.
  - Root directory on disk where all per-user folders are stored.
  - For each user, nextExplorer creates (or reuses) a subdirectory under this path when they first access their personal space.

> Note: The personal folder UI will not appear unless `USER_DIR_ENABLED=true`. The app also refuses to resolve `personal/...` when this flag is off.

### Example: development compose

The included `docker-compose.dev.yml` shows a development-friendly setup:

```yaml
services:
  backend:
    # …
    volumes:
      # Shared volumes
      - /Users/you/projects:/mnt/Projects
      - /Users/you/Downloads:/mnt/Downloads
      # Config & cache
      - /Users/you/Downloads/config:/config
      - /Users/you/Downloads/cache:/cache
      # Personal user folders on the host
      - /Users/you/Downloads/user_vols:/srv/users
    environment:
      - VOLUME_ROOT=/mnt
      - CONFIG_DIR=/config
      - CACHE_DIR=/cache
      # …
      - USER_DIR_ENABLED=true
      - USER_ROOT=/srv/users
```

With this configuration:

- All shared volumes still live under `/mnt/*` and show up under **Volumes**.
- Each authenticated user gets a private home under `/srv/users/<userFolder>/…`.
  - The `userFolder` name is derived from their id/username/email and is created automatically.
- In the UI, users see a **“My Files”** entry that opens their own personal root (`personal`).

### Example: production compose

To enable personal folders in a production deploy (see the full example in [Deployment](../installation/deployment.md)):

```yaml
services:
  nextexplorer:
    image: nxzai/explorer:latest
    environment:
      - NODE_ENV=production
      - PUBLIC_URL=https://files.example.com
      - SESSION_SECRET=please-change-me
      - PUID=1000
      - PGID=1000
      # Personal folders
      - USER_DIR_ENABLED=true
      - USER_ROOT=/srv/nextexplorer/users
    volumes:
      - /srv/nextexplorer/config:/config
      - /srv/nextexplorer/cache:/cache
      - /srv/data/Projects:/mnt/Projects
      - /srv/data/Media:/mnt/Media
      # Personal home folders on the host
      - /srv/nextexplorer/users:/srv/nextexplorer/users
```

## Permissions and access control

- Personal folders are designed to be **per-user** homes.
- By default, access control rules (Settings → Access Control) apply to logical paths:
  - You can create rules targeting `personal` or `personal/<subpath>` if you want to further restrict access.
- Favorites and quick access:
  - Users can favorite folders under both volumes and `personal/...`.
  - Favorites store the logical path (e.g. `personal/docs`), so they continue to work even if you adjust underlying mounts.

## Behavior when disabled

If `USER_DIR_ENABLED` is `false` (or unset):

- The backend rejects `personal/...` paths and does **not** create user folders.
- The `/api/features` endpoint reports `personal.enabled=false`, so:
  - The sidebar and Home view do not show the “My Files” entry.
  - All existing volume behavior remains unchanged.
