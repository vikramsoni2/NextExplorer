# Environment Reference

nextExplorer is configured almost entirely through environment variables. The backend (`backend/config/env.js`) centralizes the defaults you see here. Use this reference when you want to tune ports, paths, auth, integrations, or feature flags.

## Server & networking

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Port the Express API and frontend listen on inside the container. |
| `PUBLIC_URL` | _none_ | External URL (no trailing slash). Drives cookie settings, CORS defaults, and derived callback URLs (OIDC/OnlyOffice). |
| `TRUST_PROXY` | `loopback,uniquelocal` when `PUBLIC_URL` is set | Express trust proxy configuration. Accepts `false`, numbers, CIDRs, or lists. |
| `CORS_ORIGIN`, `CORS_ORIGINS`, `ALLOWED_ORIGINS` | _empty_ | Comma-separated list of allowed CORS origins. Defaults to `PUBLIC_URL` origin when set. |

## Paths & volumes

| Variable | Default | Description |
| --- | --- | --- |
| `VOLUME_ROOT` | `/mnt` | Root directory that houses all mounted volumes. |
| `CONFIG_DIR` | `/config` | Location for SQLite, `app-config.json`, extensions, and settings. |
| `CACHE_DIR` | `/cache` | Location for thumbnails, ripgrep indexes, and temporary data. |

## Authentication

| Variable | Default | Description |
| --- | --- | --- |
| `AUTH_ENABLED` | `true` (in prod) | Toggles authentication; disabling makes all APIs public. **Deprecated:** use `AUTH_MODE=disabled` instead. |
| `AUTH_MODE` | `both` (or `local` if OIDC not configured) | Controls which authentication methods are available: `local` (username/password only), `oidc` (SSO only), `both` (both methods), or `disabled` (skip login entirely, same as `AUTH_ENABLED=false`). |
| `SESSION_SECRET`, `AUTH_SESSION_SECRET` | _auto-generated_ | Session secret used by Express; set it explicitly to keep sessions across restarts or replicas. |
| `AUTH_MAX_FAILED` | `5` | Failed login attempts before temporary lockout. |
| `AUTH_LOCK_MINUTES` | `15` | Lockout duration in minutes when max failures reached. |

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

## Feature toggles

| Variable | Default | Description |
| --- | --- | --- |
| `SEARCH_DEEP` | _false_ | Enables deep content search; ripgrep is used when `SEARCH_RIPGREP` is true. |
| `SEARCH_RIPGREP` | _true_ | Prefer ripgrep for fast searches; fallback search is used when unavailable. |
| `SEARCH_MAX_FILESIZE` | _unbounded_ | Skip ripgrep for files larger than this (e.g., `5MB`). |
| `SHOW_VOLUME_USAGE` | `false` | Show volume usage badges in the sidebar. |

## OnlyOffice & thumbnails

| Variable | Default | Description |
| --- | --- | --- |
| `ONLYOFFICE_URL` | _none_ | Public URL for Document Server (must reach your app’s `PUBLIC_URL`). |
| `ONLYOFFICE_SECRET` | _none_ | JWT secret shared with OnlyOffice Document Server for `/api/onlyoffice` calls. |
| `ONLYOFFICE_LANG` | `en` | Language code for the editor UI. |
| `ONLYOFFICE_FORCE_SAVE` | `false` | When true, OnlyOffice forces users to save via the editor UI. |
| `ONLYOFFICE_FILE_EXTENSIONS` | _default list_ | Extra file extensions to surface to the Document Server. |
| `FFMPEG_PATH`, `FFPROBE_PATH` | _bundled binaries_ | Point to custom ffmpeg/ffprobe if the bundle doesn’t suit your needs. |

## Container user mapping

| Variable | Description |
| --- | --- |
| `PUID`, `PGID` | Map container processes to host user/group IDs so created files have consistent ownership. Defaults to `1000`. The entrypoint adjusts ownership of `/app`, `/config`, and `/cache` accordingly.
