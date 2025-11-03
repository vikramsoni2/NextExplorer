# nextExplorer

A modern, self-hosted file explorer with secure access control, polished UX, and a Docker-friendly deployment story.


## Release 

- added OIDC support for multi-user
- added user menu in the sidebar
- added tooltips to icons
- added public url for proxies, preparation for file sharing
- sidebar now resizable
- search in the current directory for files and content inside files as well using ripgrep
- added right-click context menu for file actions
- new file creation option in context menu
- responsive sidebar, breadcrumb and view mode options
- syntax highlighting for editor
- new folder option added to context menu as well


## Feature Highlights
- Secure access with local users and optional OIDC single sign‑on.
- Browse, preview, upload, move, and delete files across multiple mounted volumes.
- Switch between light and dark layouts, plus grid or detail views for folders.
- Generate and cache thumbnails for images and videos to keep navigation fast.
- Edit text-based files inline with a built-in, syntax-aware code editor.
- Preview Images and Videos using in-built viewer

## Screenshots
| | |
| --- | --- |
| ![Password creation screen showing Explorer branding and secure access badge](./docs/source/images/1.png) | ![Unlock modal prompting for the workspace password](./docs/source/images/2.png) |
| Lock the workspace with a master password before anyone can browse. | Re-enter the password to unlock trusted sessions. |
| ![Dark theme grid view of folders and mixed media files](./docs/source/images/3.png) | ![Light theme view of a project directory with files and folders](./docs/source/images/4.png) |
| Grid view keeps media heavy folders easy to scan. | Light theme works well for bright shared spaces. |
| ![Dark list view showing metadata like size and modified time](./docs/source/images/5.png) | ![Upload manager tracking progress for multiple files](./docs/source/images/6.png) |
| Detail view surfaces metadata like file size and timestamps. | Track multi-file uploads with per-item progress feedback. |

## Self-Host with Docker Compose

### 1. Prerequisites
- Docker Engine 24+ and Docker Compose v2.
- Host directories that you want to expose to the explorer.
- A writable cache directory for generated thumbnails (recommended: SSD-backed storage).

### 2. Prepare host folders
Create or pick folders you plan to mount, for example:
- `/srv/nextexplorer/cache` for cached thumbnails and settings.
- `/srv/data/Projects` and `/srv/data/Downloads` for content you want to browse.
Ensure the Docker user has read/write permissions to each directory.

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
      - PUBLIC_URL=http://localhost:3000
      - SESSION_SECRET=please-change-me
      # Optional: match the container user/group to your host IDs
      # - PUID=1000
      # - PGID=1000
      # Optional OIDC (see section below)
      # - OIDC_ENABLED=true
      # - OIDC_ISSUER=https://auth.example.com/application/o/next/
      # - OIDC_CLIENT_ID=nextexplorer
      # - OIDC_CLIENT_SECRET=your-client-secret
      # - OIDC_SCOPES=openid profile email groups
      # - OIDC_ADMIN_GROUPS=next-admin admins
    volumes:
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

### 5. Map container user IDs (recommended)
1. On the host, run `id -u` and `id -g` to capture your user and group IDs.
2. Set the `PUID` and `PGID` environment variables in your Compose file so the container runs as your user.
3. Restart the stack; any files created through nextExplorer will now be owned by your user on the host.

### 6. First-run setup
1. Open the app in your browser.
2. Create the first local admin account on the Setup screen.
3. Browse the Volumes panel to verify each mount shows up as expected.
4. Start uploading or editing files—thumbnails will populate the cache automatically.

Sign‑in options:
- Local users: the username/password you created on first run.
- OIDC SSO (if enabled): click “Continue with Single Sign‑On”.

### 7. Updating
To pull the latest release:

```bash
docker compose pull
docker compose up -d
```

The container persists user settings in `/cache` and never touches the contents of your mounted volumes unless you explicitly upload, move, or delete items through the UI.

## Need Something Else?
- For local development, see [`README-development.md`](./README-development.md).
- Issues or feature ideas? Open a ticket on the project tracker or start a discussion with the maintainers.

## Running Behind a Reverse Proxy (e.g., Nginx Proxy Manager)

When placing nextExplorer behind a reverse proxy and a custom domain, set a single environment variable and the app will derive everything it needs:

- `PUBLIC_URL` – the fully-qualified public URL for your app (no trailing slash). Example: `https://files.example.com`

What it controls:
- CORS allowed origin defaults to the origin of `PUBLIC_URL` unless you explicitly set `CORS_ORIGINS`.
- OIDC callback URL defaults to `PUBLIC_URL + /callback` unless you explicitly set `OIDC_CALLBACK_URL`.
- Express configures a safe `trust proxy` default when `PUBLIC_URL` is provided (can be overridden with `TRUST_PROXY`).

Compose example:

```yaml
services:
  nextexplorer:
    image: nxzai/explorer:latest
    environment:
      - NODE_ENV=production
      - PUBLIC_URL=https://files.example.com
      # Optional: override or add more CORS origins
      # - CORS_ORIGINS=https://files.example.com,https://admin.example.com
      # Optional: override OIDC callback if you need a non-default path
      # - OIDC_CALLBACK_URL=https://files.example.com/custom/callback
    ports:
      - "3000:3000"  # or run without publishing and let the proxy connect the container network
```

Nginx Proxy Manager tips:
- Point your domain to the container’s internal port 3000.
- Enable Websockets and preserve `X-Forwarded-*` headers (enabled by default in NPM).
- Terminate TLS at the proxy; nextExplorer will treat cookies as Secure in production.

### Trust Proxy settings

- Default: When `PUBLIC_URL` is set and `TRUST_PROXY` is not, the app sets `trust proxy` to `loopback,uniquelocal`. This trusts only local/private reverse proxies (Docker/Traefik/Nginx on RFC1918/loopback ranges) and avoids the security risk of trusting arbitrary clients.
- Override: Set `TRUST_PROXY` explicitly for your topology. Supported values:
  - `false` – disable trusting proxies (Express default).
  - A number (e.g. `1`, `2`) – trust that many hops in `X-Forwarded-For`.
  - A string list – e.g. `loopback,uniquelocal` or CIDRs/IPs like `10.0.0.0/8,172.16.0.0/12,192.168.0.0/16`.
- Note: `TRUST_PROXY=true` is not accepted as-is; it is mapped to `loopback,uniquelocal` to prevent IP spoofing and satisfy `express-rate-limit` safety checks.

## OIDC (OpenID Connect) Authentication

nextExplorer supports OIDC providers such as Keycloak, Authentik, Authelia, Google, and others via a provider‑agnostic setup powered by Express OpenID Connect (EOC).

### Environment variables
- `OIDC_ENABLED`: `true|false` to enable OIDC.
- `OIDC_ISSUER`: Provider issuer URL (used for discovery). Example: `https://id.example.com/application/o/your-app/`.
- `OIDC_AUTHORIZATION_URL`, `OIDC_TOKEN_URL`, `OIDC_USERINFO_URL` (optional): Manually override endpoints. If omitted, discovery is used from `OIDC_ISSUER`.
- `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`: Credentials for your app.
- `OIDC_CALLBACK_URL` (optional): Callback URL. If not set, derived from `PUBLIC_URL` as `${PUBLIC_URL}/callback`.
- `OIDC_SCOPES` (optional): Space/comma separated scopes. Default: `openid profile email`. Add `groups` if your provider exposes it.
- `OIDC_ADMIN_GROUPS` (recommended): Space/comma separated group names that should map to the app’s `admin` role, e.g. `next-admin admins`.
- `SESSION_SECRET` (required when OIDC or local sessions are used): strong random string enabling secure sessions.

Notes:
- Discovery: If `OIDC_AUTHORIZATION_URL`/`OIDC_TOKEN_URL`/`OIDC_USERINFO_URL` are not supplied, the app fetches them from `OIDC_ISSUER/.well-known/openid-configuration`.
- Callback: If you run behind a reverse proxy, set `PUBLIC_URL` so the default callback is correct.

Endpoints when OIDC is enabled (via EOC):
- `GET /login` – start login; optionally `?returnTo=/path` to redirect after auth
- `GET /callback` – OIDC callback (configure this in your provider)
- `GET /logout` – end session; IdP logout is optional
- Convenience: `GET /api/auth/oidc/login?redirect=/path` triggers the same login flow

### Admin role mapping
- Provider‑agnostic: The app only looks at standard OIDC claims for group‑like values: `groups`, `roles`, `entitlements` (arrays or space/comma strings).
- Config‑driven: A user becomes `admin` only if they belong to any group listed in `OIDC_ADMIN_GROUPS` (case‑insensitive). Otherwise the user gets role `user`.
- No implicit defaults: There are no built‑in admin group names. If `OIDC_ADMIN_GROUPS` is empty/unset, no OIDC user is auto‑elevated.
- Safety: If an existing user already has the `admin` role, the app preserves it on subsequent logins to avoid accidental demotion.

Example compose snippet:

```yaml
services:
  nextexplorer:
    image: nxzai/explorer:latest
    environment:
      - PUBLIC_URL=https://files.example.com
      - SESSION_SECRET=please-change-me
      - OIDC_ENABLED=true
      - OIDC_ISSUER=https://auth.example.com/application/o/next/
      # Optional manual overrides (otherwise discovery is used)
      # - OIDC_AUTHORIZATION_URL=...
      # - OIDC_TOKEN_URL=...
      # - OIDC_USERINFO_URL=...
      - OIDC_CLIENT_ID=your-client-id
      - OIDC_CLIENT_SECRET=your-client-secret
      - OIDC_SCOPES=openid profile email groups
      - OIDC_ADMIN_GROUPS=next-admin admins
```

Provider tips:
- Authentik/Keycloak: Usually expose `groups`; include `groups` in scopes.
- Google: Group claims typically require additional configuration (Cloud Identity / Admin SDK). Without groups, users will be `user` role by default.

## Configuration (Quick Reference)
- `PUBLIC_URL`: external site URL; derives CORS and default OIDC callback.
- `SESSION_SECRET`: required for sessions (local auth and OIDC).
- `VOLUME_ROOT`: root for mounted content inside container (default `/mnt`).
- `CACHE_DIR`: settings and thumbnails (default `/cache`).
- `TRUST_PROXY`: `false`, a hop count, or list like `loopback,uniquelocal` (defaults safely when `PUBLIC_URL` is set).
- `CORS_ORIGINS`: comma list of allowed origins (defaults to `PUBLIC_URL` origin; otherwise allows all for dev).
