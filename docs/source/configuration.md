# Configuration

Most configuration is done via environment variables. Defaults are chosen to be safe and sensible for containerized deployments.

Core

- `PORT` – API/UI port. Default: `3000`.
- `PUBLIC_URL` – Fully‑qualified external URL (no trailing slash). Example: `https://files.example.com`. Used to derive cookies, default callback, and CORS.
- `SESSION_SECRET` – Required to enable sessions (local auth and OIDC). Set to a strong random string.

Filesystem

- `VOLUME_ROOT` – Root directory inside the container that holds your mounted folders. Default: `/mnt`.
- `CACHE_DIR` – App cache (settings, thumbnails). Default: `/cache`.

Reverse proxy and CORS

- `TRUST_PROXY` – Controls Express “trust proxy”.
  - `false` disables trusting proxies
  - A number (`1`, `2`) trusts that many hops
  - A list (e.g. `loopback,uniquelocal` or CIDRs `10.0.0.0/8,...`)
  - If set to `true`, the app maps it to `loopback,uniquelocal` for safety
  - If unset but `PUBLIC_URL` is set, defaults to `loopback,uniquelocal`
- `CORS_ORIGIN`, `CORS_ORIGINS`, or `ALLOWED_ORIGINS` – Comma‑separated allowed origins. If unset and `PUBLIC_URL` is set, defaults to its origin; otherwise allows all (for local/dev use).

Authentication (OIDC)

- `OIDC_ENABLED` – `true|false` to enable SSO.
- `OIDC_ISSUER` – Provider issuer URL (discovery). Examples:
  - Keycloak realm: `https://id.example.com/realms/main`
  - Authentik app: `https://auth.example.com/application/o/next/`
  - Authelia: `https://auth.example.com`
- `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` – Client credentials.
- `OIDC_SCOPES` – Default: `openid profile email`. Add `groups` to map admins.
- `OIDC_ADMIN_GROUPS` – Space/comma separated list (case‑insensitive). If a user’s `groups`/`roles`/`entitlements` includes any entry here, they’re elevated to `admin`.
- `OIDC_AUTHORIZATION_URL`, `OIDC_TOKEN_URL`, `OIDC_USERINFO_URL` – Optional manual overrides; otherwise discovered from the issuer.
- `OIDC_CALLBACK_URL` – Optional explicit callback. If unset and `PUBLIC_URL` is provided, the app defaults to `${PUBLIC_URL}/callback`.

Thumbnails and search

- `FFMPEG_PATH`, `FFPROBE_PATH` – Optional paths to ffmpeg/ffprobe binaries (auto‑installed in the official image).
- ripgrep (`rg`) – Used for fast content/filename search. The image bundles ripgrep; the app falls back to a built‑in search if unavailable.

Container user mapping

- `PUID`, `PGID` – Map the container user to your host IDs so created files are owned by you. Defaults: `1000:1000`. The entrypoint adjusts ownership for `/app` and `/cache`.

Frontend (dev only)

- `VITE_BACKEND_ORIGIN` – When running the Vite dev server, proxy API calls to the backend origin (e.g. `http://localhost:3001`).
- `VITE_API_URL` – Alternate way to point the SPA directly at an API base URL.

