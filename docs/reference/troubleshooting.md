# Troubleshooting

Keep this page handy when deployment, authentication, or UI behaviors need quick fixes.

## Authentication & sessions

- **OIDC redirect errors:** Make sure your identity provider uses `${PUBLIC_URL}/callback` (or `OIDC_CALLBACK_URL`) as the redirect URI.
- **Session resets after restart:** Set `SESSION_SECRET` so the app doesn't regenerate a new secret each start.
- **Users logged out after browser restart:** Sessions persist by default for 30 days. If users are being logged out, check that `SESSION_SECRET` is set and stable. Adjust `SESSION_MAX_AGE_DAYS` to change the session duration.
- **Users not admin:** Confirm that the user's `groups`, `roles`, or `entitlements` include a value listed in `OIDC_ADMIN_GROUPS` (case-insensitive).
- **Cookies marked insecure behind HTTPS:** Ensure `PUBLIC_URL` uses `https` and your proxy forwards `X-Forwarded-Proto` and `Host`.

## Access & permissions

- **Path marked read-only or hidden:** Check Settings → Access Control for matching rules; `hidden` and `ro` rules block writes even if user has permission.
- **Missing volume entries:** Confirm your `docker-compose` mounts include `/mnt/Label` entries and the container has read access.
- **Path not found after remounting:** Restart the container whenever you change `docker/docker-compose.yml` mounts so the app rescans volumes.

## Search & thumbnails

- **Slow or missing search results:** Install or enable ripgrep. The official image bundles `rg`; custom builds need either the tool or fallback search (which may skip large files controlled by `SEARCH_MAX_FILESIZE`).
- **Thumbnails not generating:** Verify FFmpeg/ffprobe are available (paths override via `FFMPEG_PATH`/`FFPROBE_PATH`) and that `/cache` is writable.
- **Cache rebuild:** Clearing `/cache` removes thumbnails/indexes but keeps user data. The app regenerates thumbnails when you revisit folders.

## Reverse proxy issues

- **CORS errors:** Set `PUBLIC_URL`, `CORS_ORIGINS`, or `ALLOWED_ORIGINS` to include the domain you access from.
- **Websocket or upload failures:** Ensure the proxy forwards WebSocket upgrades and `X-Forwarded-*` headers.
- **Trust proxy misconfiguration:** Set `TRUST_PROXY` to `loopback,uniquelocal`, a number of hops, or explicit CIDRs depending on your topology.

## Updates & persistence

- **Settings lost after update:** Mount `/config` persistently; it contains `app.db`, `app-config.json`, and extensions. Back this folder up before upgrading.
- **`/cache` filling disk:** `/cache` holds thumbnails and indexes; delete it if you need to reclaim space (the app rebuilds contents as needed).

## ONLYOFFICE token errors

- "Document security token is not correctly configured" typically means the Document Server and nextExplorer share mismatched `ONLYOFFICE_SECRET`. Double-check the secret stored in `/etc/onlyoffice/documentserver/local.json` and update both sides to match.
