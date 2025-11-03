# Troubleshooting

Common issues and fixes

Authentication

- OIDC login fails with redirect error
  - Ensure your IdP has the redirect URI set to `${PUBLIC_URL}/callback`
  - Verify `PUBLIC_URL` matches your external URL and the proxy forwards `X‑Forwarded‑Proto`/`Host`
- Not staying signed in behind proxy
  - Confirm cookies are not stripped; set `TRUST_PROXY` appropriately (see Reverse Proxy)
  - Set a stable `SESSION_SECRET`
- OIDC users not admin
  - Include `groups` in `OIDC_SCOPES` and map groups in your IdP
  - Set `OIDC_ADMIN_GROUPS` to the expected group names (case‑insensitive)

Access & permissions

- “Path is read‑only” or missing items
  - Check Settings → Access Control rules; the first matching rule applies (`ro` or `hidden`)
  - Verify the host path permissions for the mounted volume
- “Path not found” after changing mounts
  - Restart the container if you updated your `docker-compose.yml` mounts

Search

- Slow or incomplete results
  - Install ripgrep (`rg`) on custom images; the official image includes it
  - The built‑in fallback skips content search for large files over 5 MB

Thumbnails

- No video thumbnails
  - Ensure FFmpeg/ffprobe are available (included in official image)
  - You can override binary paths with `FFMPEG_PATH`/`FFPROBE_PATH`

Reverse proxy

- CORS errors in browser console
  - Set `PUBLIC_URL` and/or `CORS_ORIGINS` to include your site’s origin
  - Avoid `*` in production unless you fully understand the implications

Upgrades and data

- Settings/users lost after update
  - Make sure `/cache` is mounted to a persistent host folder
  - Back up `/cache/app-config.json` and the `thumbnails` subfolder as needed

