<p align="center">
  <img src="docs/public/images/logo.png" width="96" height="96" alt="nextExplorer logo" />
</p>

<h1 align="center">NextExplorer</h1>

<p align="center">
  A modern, self-hosted file explorer with secure access control, polished UX, and a Docker-first deployment.
</p>

<p align="center">
  Docs: <a href="https://explorer.nxz.ai/">explorer.nxz.ai</a>
</p>

## Demo

- https://explorer-latest.onrender.com
- Username: `demo@example.com`
- Password: `password`

## Highlights

- Secure by default: local users & groups, optional OIDC SSO.
- Fast previews: images, videos, PDFs, thumbnails (FFmpeg), and inline players.
- Built-in editor: edit text/code with syntax highlighting (extensible via `EDITOR_EXTENSIONS`).
- Sharing workflows: link-based sharing (read-only/read-write), guest access, “Shared with me”.
- Smart search: ripgrep-backed filename + content search with tunable limits.
- Modern UX: grid/list/column views, drag-and-drop, context menus, keyboard shortcuts.
- Docker-native: single image, mount volumes under `/mnt`, reverse-proxy friendly via `PUBLIC_URL`.

## Quickstart (Docker Compose)

```yaml
services:
  nextexplorer:
    image: nxzai/explorer:latest
    container_name: nextexplorer
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./config:/config
      - ./cache:/cache
      # Each /mnt/<Label> mount becomes a top-level volume in the UI
      - /path/to/your/files:/mnt/Files
    environment:
      - NODE_ENV=production
      - PUBLIC_URL=http://localhost:3000
```

<details>

<summary> Full docker-compose with all configurations</summary>

```yaml
services:
  nextexplorer:
    image: nxzai/explorer:latest
    container_name: nextexplorer
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./config:/config # contains config files, db, settings etc.
      - ./cache:/cache # contains thumbnail cache and other files which are generated automatically

      # Each /mnt/<Label> mount becomes a top-level volume in the UI
      - /path/to/your/files:/mnt/Files

    environment:
      # Required basics
      NODE_ENV: production # Set to `production` for the Docker image defaults.
      PORT: "3000" # Port the Express API + frontend listen on *inside* the container.
      PUBLIC_URL: "http://localhost:3000" # External URL (no trailing slash); drives cookies, CORS defaults, and derived callback URLs.

      # Reverse proxy / networking (optional)
      # TRUST_PROXY: "loopback,uniquelocal" # Express trust proxy config; set when running behind a reverse proxy (often auto-derived when `PUBLIC_URL` is set).
      # CORS_ORIGINS: "" # Comma-separated allowed origins; aliases: `CORS_ORIGIN`, `ALLOWED_ORIGINS` (defaults to `PUBLIC_URL` origin when set).

      # Logging & debugging (optional)
      # LOG_LEVEL: "info" # `trace|debug|info|warn|error` (defaults to `debug` when `DEBUG=true`).
      # DEBUG: "false" # When `true`, forces `LOG_LEVEL=debug` and enables more verbose diagnostics.
      # ENABLE_HTTP_LOGGING: "false" # When `true`, logs HTTP requests (recommended with centralized logs in production).

      # Paths & volumes (optional)
      # VOLUME_ROOT: "/mnt" # Root directory that houses all mounted volumes. App will display all directores inside this directory as volumes.
      # CONFIG_DIR: "/config" # Location for SQLite, `app-config.json`, extensions, and settings.
      # CACHE_DIR: "/cache" # Location for thumbnails, ripgrep indexes, and temporary data.
      # USER_ROOT: "/mnt/_users" # Root directory for per-user personal folders (defaults to `<VOLUME_ROOT>/_users` when unset). Make sure you persist this path if you use USER_DIR_ENABLED.

      # Authentication (optional)
      # AUTH_MODE: "both" # `local|oidc|both|disabled` what authentication methods you want to enable.
      # AUTH_ENABLED: "true" # Deprecated: use `AUTH_MODE=disabled` to skip login.
      # SESSION_SECRET: "please-change-me" # Session cookie secret (alias: `AUTH_SESSION_SECRET`); set a long, random, stable value (>= 32 chars) to keep sessions valid across restarts/replicas.
      # AUTH_MAX_FAILED: "5" # Failed login attempts before temporary lockout.
      # AUTH_LOCK_MINUTES: "15" # Lockout duration (minutes) when max failures reached.
      # AUTH_ADMIN_EMAIL: "" # First-run bootstrap (local auth): when set with `AUTH_ADMIN_PASSWORD`, creates an admin user on startup and skips setup.
      # AUTH_ADMIN_PASSWORD: "" # Password for `AUTH_ADMIN_EMAIL` bootstrap; overrides/resets password on startup if the user already exists.

      # OIDC & SSO (optional)
      # OIDC_ENABLED: "false" # Enable Express OpenID Connect auth flow.
      # OIDC_ISSUER: "https://auth.example.com/application/o/next/" # IdP issuer URL (discovery).
      # OIDC_AUTHORIZATION_URL: "" # Optional discovery override.
      # OIDC_TOKEN_URL: "" # Optional discovery override.
      # OIDC_USERINFO_URL: "" # Optional discovery override.
      # OIDC_CLIENT_ID: "nextexplorer" # IdP client ID.
      # OIDC_CLIENT_SECRET: "" # IdP client secret.
      # OIDC_CALLBACK_URL: "http://localhost:3000/callback" # Explicit callback URL (defaults to `${PUBLIC_URL}/callback` when `PUBLIC_URL` is set).
      # OIDC_SCOPES: "openid profile email" # Add `groups` to propagate group claims.
      # OIDC_ADMIN_GROUPS: "" # Space/comma-separated group names that grant admin rights (matched in `groups`, `roles`, or `entitlements`).
      # OIDC_REQUIRE_EMAIL_VERIFIED: "false" # When `true`, requires IdP to verify user email before allowing user creation/auto-linking.
      # OIDC_AUTO_CREATE_USERS: "true" # When `false`, denies OIDC login unless the user already exists in the DB.

      # Feature toggles (optional)
      # SEARCH_DEEP: "false" # Enables deep content search (ripgrep used when `SEARCH_RIPGREP=true`).
      # SEARCH_RIPGREP: "true" # Prefer ripgrep for fast searches; fallback search used when unavailable.
      # SEARCH_MAX_FILESIZE: "" # Skip ripgrep for files larger than this (e.g., `5MB`).
      # SHOW_VOLUME_USAGE: "false" # Show volume usage badges in the sidebar.
      # USER_DIR_ENABLED: "false" # Enables per-user “My Files” spaces under `USER_ROOT`.
      # USER_VOLUMES: "false" # Restrict non-admin users to only volumes assigned by an admin.
      # SKIP_HOME: "false" # When `true`, `/browse/` redirects into the first volume.

      # Editor (optional)
      # EDITOR_EXTENSIONS: "" # Extra file extensions supported by the inline editor (comma-separated, added to built-in defaults).

      # OnlyOffice & thumbnails (optional)
      # ONLYOFFICE_URL: "" # Public URL for OnlyOffice Document Server (must reach your app's `PUBLIC_URL`).
      # ONLYOFFICE_SECRET: "" # JWT secret shared with OnlyOffice Document Server for `/api/onlyoffice`.
      # ONLYOFFICE_LANG: "en" # Language code for the editor UI.
      # ONLYOFFICE_FORCE_SAVE: "false" # When `true`, OnlyOffice forces users to save via the editor UI.
      # ONLYOFFICE_FILE_EXTENSIONS: "" # Extra file extensions to surface to the Document Server.
      # FFMPEG_PATH: "" # Point to a custom ffmpeg binary (defaults to bundled binary).
      # FFPROBE_PATH: "" # Point to a custom ffprobe binary (defaults to bundled binary).

      # Container user mapping (optional)
      # PUID: "1000" # Map container processes to host UID so created files have consistent ownership.
      # PGID: "1000" # Map container processes to host GID so created files have consistent ownership.
```
</details>

## Documentation

- Quick start: https://explorer.nxz.ai/quick-launch/overview.html
- Visual tour: https://explorer.nxz.ai/quick-launch/visual-tour.html
- Feature guide: https://explorer.nxz.ai/experience/features.html
- Admin & access control: https://explorer.nxz.ai/admin/guide.html
- Deployment & reverse proxy: https://explorer.nxz.ai/installation/deployment.html and https://explorer.nxz.ai/installation/reverse-proxy.html
- Environment variables: https://explorer.nxz.ai/configuration/environment.html
- Runtime settings: https://explorer.nxz.ai/configuration/settings.html
- Integrations (OIDC, Authelia, ONLYOFFICE): https://explorer.nxz.ai/integrations/oidc.html
- Troubleshooting/FAQ: https://explorer.nxz.ai/reference/troubleshooting.html and https://explorer.nxz.ai/reference/faq.html
- Releases: https://explorer.nxz.ai/reference/releases.html
