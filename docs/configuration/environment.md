# Environment Reference

nextExplorer is configured almost entirely through environment variables. The backend (`backend/src/config/env.js`) centralizes the defaults you see here. Use this reference when you want to tune ports, paths, auth, integrations, or feature flags.

## Server & networking

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Port the Express API and frontend listen on inside the container. |
| `PUBLIC_URL` | _none_ | External URL (no trailing slash). Drives cookie settings, CORS defaults, and derived callback URLs (OIDC/OnlyOffice). |
| `TRUST_PROXY` | `loopback,uniquelocal` when `PUBLIC_URL` is set | Express trust proxy configuration. Accepts `false`, numbers, CIDRs, or lists. |
| `CORS_ORIGIN`, `CORS_ORIGINS`, `ALLOWED_ORIGINS` | _empty_ | Comma-separated list of allowed CORS origins. Defaults to `PUBLIC_URL` origin when set. |

## Logging & debugging

| Variable | Default | Description |
| --- | --- | --- |
| `LOG_LEVEL` | `info` (or `debug` when `DEBUG=true`) | Application log level: `trace`, `debug`, `info`, `warn`, or `error`. |
| `DEBUG` | `false` | When `true`, forces `LOG_LEVEL=debug` and shows more verbose diagnostics (including more detailed error output in development). |
| `ENABLE_HTTP_LOGGING` | `false` | When `true`, enables HTTP request logging in the backend (use with centralized log collection in production). |

## Paths & volumes

| Variable | Default | Description |
| --- | --- | --- |
| `VOLUME_ROOT` | `/mnt` | Root directory that houses all mounted volumes. |
| `CONFIG_DIR` | `/config` | Location for SQLite, `app-config.json`, extensions, and settings. |
| `CACHE_DIR` | `/cache` | Location for thumbnails, ripgrep indexes, and temporary data. |
| `USER_ROOT` | `<VOLUME_ROOT>/_users` when unset | Root directory for **per-user personal folders**. Each authenticated user gets their own subdirectory under this path. |

## Authentication

| Variable | Default | Description |
| --- | --- | --- |
| `AUTH_ENABLED` | `true` (in prod) | Toggles authentication; disabling makes all APIs public. **Deprecated:** use `AUTH_MODE=disabled` instead. |
| `AUTH_MODE` | `both` (or `local` if OIDC not configured) | Controls which authentication methods are available: `local` (username/password only), `oidc` (SSO only), `both` (both methods), or `disabled` (skip login entirely, same as `AUTH_ENABLED=false`). |
| `SESSION_SECRET`, `AUTH_SESSION_SECRET` | _auto-generated_ | Cryptographic secret used by Express to sign and encrypt session cookies and related tokens. In production, set this to a long, random, **stable** value (at least 32 characters) so sessions remain valid across restarts and multiple replicas; if left unset, a new random secret is generated on each start and all users will be logged out after every restart. |
| `AUTH_MAX_FAILED` | `5` | Failed login attempts before temporary lockout. |
| `AUTH_LOCK_MINUTES` | `15` | Lockout duration in minutes when max failures reached. |
| `AUTH_ADMIN_EMAIL` | _none_ | Optional first-run bootstrap for local auth: when set with `AUTH_ADMIN_PASSWORD`, the backend creates an admin user on startup (and the setup wizard is skipped). |
| `AUTH_ADMIN_PASSWORD` | _none_ | Password used for `AUTH_ADMIN_EMAIL` bootstrap. If a user already exists with the same email, this value **overrides/resets** the local password on startup. (Minimum 6 chars; avoid leaving this set unless you want the password enforced on every restart.) |

## OIDC & SSO

| Variable | Default | Description |
| --- | --- | --- |
| `OIDC_ENABLED` | `false` | Enable Express OpenID Connect authentication flow. |
| `OIDC_ISSUER` | _none_ | IdP issuer URL (discovery). |
| `OIDC_AUTHORIZATION_URL`, `OIDC_TOKEN_URL`, `OIDC_USERINFO_URL` | _none_ | Optional overrides for discovery endpoints. |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | _none_ | IdP credentials. |
| `OIDC_CALLBACK_URL` | `${PUBLIC_URL}/callback` when `PUBLIC_URL` is set | Explicit callback path; defaults to `/callback` under `PUBLIC_URL`. |
| `OIDC_SCOPES` | `openid profile email` | Default scopes; add `groups` to propagate group claims. |
| `OIDC_ADMIN_GROUPS` | _none_ | Space/comma-separated names that grant admin rights when found in `groups`, `roles`, or `entitlements`. |
| `OIDC_REQUIRE_EMAIL_VERIFIED` | `false` | When `true`, requires the IdP to verify the user's email before allowing user creation or auto-linking. Some providers like newer Authentik versions set `email_verified` to `false` by default. |

## Feature toggles

| Variable | Default | Description |
| --- | --- | --- |
| `SEARCH_DEEP` | _false_ | Enables deep content search; ripgrep is used when `SEARCH_RIPGREP` is true. |
| `SEARCH_RIPGREP` | _true_ | Prefer ripgrep for fast searches; fallback search is used when unavailable. |
| `SEARCH_MAX_FILESIZE` | _unbounded_ | Skip ripgrep for files larger than this (e.g., `5MB`). |
| `SHOW_VOLUME_USAGE` | `false` | Show volume usage badges in the sidebar. |
| `USER_DIR_ENABLED` | `false` | When `true`, enables a **personal “My Files” space** for each authenticated user under `USER_ROOT`. The frontend shows a “My Files” entry when this flag is on. |
| `USER_VOLUMES` | `false` | When `true`, non-admin users only see volumes assigned to them by an admin. See [User volumes](/admin/user-volumes). |
| `SKIP_HOME` | `false` | When `true`, visits to the home view (`/browse/`) automatically redirect into the first volume instead. |

The sharing system (toolbar **Share** button, guest links such as `/share/:token`, and the **Shared with me** page) works out of the box with the feature flags above. Advanced share tuning knobs are documented under **Sharing (advanced)** below.

## Editor

| Variable | Default | Description |
| --- | --- | --- |
| `EDITOR_EXTENSIONS` | _empty_ | Comma-separated list of additional file extensions to support in the inline text editor (e.g., `toml,proto,graphql`). These are **added to** the built-in defaults (txt, md, json, js, ts, py, etc.), not replacing them. Changes take effect immediately on container restart—no frontend rebuild required. |

## OnlyOffice & thumbnails

| Variable | Default | Description |
| --- | --- | --- |
| `ONLYOFFICE_URL` | _none_ | Public URL for Document Server (must reach your app's `PUBLIC_URL`). |
| `ONLYOFFICE_SECRET` | _none_ | JWT secret shared with OnlyOffice Document Server for `/api/onlyoffice` calls. |
| `ONLYOFFICE_LANG` | `en` | Language code for the editor UI. |
| `ONLYOFFICE_FORCE_SAVE` | `false` | When true, OnlyOffice forces users to save via the editor UI. |
| `ONLYOFFICE_FILE_EXTENSIONS` | _default list_ | Extra file extensions to surface to the Document Server. |
| `FFMPEG_PATH`, `FFPROBE_PATH` | _bundled binaries_ | Point to custom ffmpeg/ffprobe if the bundle doesn't suit your needs. |

<!-- 
## Sharing (advanced)

These variables are available for tuning the share system. The defaults are suitable for most deployments; many are primarily useful in large or highly regulated environments.

| Variable | Default | Description |
| --- | --- | --- |
| `SHARES_ENABLED` | `true` | Master toggle for the share feature. When disabled, share-related features are considered off. |
| `SHARES_TOKEN_LENGTH` | `10` | Length of generated share tokens (affects `/share/:token` URL length). |
| `SHARES_MAX_PER_USER` | `100` | Soft cap on the number of shares a single user can create. |
| `SHARES_DEFAULT_EXPIRY_DAYS` | `30` | Default expiration (in days) used when a share is created without an explicit expiry. |
| `SHARES_GUEST_SESSION_HOURS` | `24` | Intended lifetime (in hours) for guest sessions created when visitors open “anyone with link” shares. |
| `SHARES_ALLOW_PASSWORD` | `true` | Whether password-protected shares are allowed. |
| `SHARES_ALLOW_ANONYMOUS` | `true` | Whether “anyone with the link” shares are allowed (as opposed to user-specific shares only). | -->

## Container user mapping

| Variable | Description |
| --- | --- |
| `PUID`, `PGID` | Map container processes to host user/group IDs so created files have consistent ownership. Defaults to `1000`. The entrypoint adjusts ownership of `/app`, `/config`, and `/cache` accordingly.
