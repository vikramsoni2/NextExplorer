# FAQ

## What do I need before installing?
- Docker Engine 24+ and Docker Compose v2.
- Host folders to mount under `/mnt` and persistent storage for `/config` (back it up) plus optional `/cache`.
- Optional environment variables for your preferred authentication, reverse proxy, and feature toggles; see the [Environment Reference](../configuration/environment) for the full list.

## How do I unlock the workspace after first setup?
The Setup screen creates the first admin. Once the workspace password is set, use that login to add local users or configure OIDC. Admin-only settings live under Settings → Admin.

## Where do I troubleshoot deployment issues?
Check the [Troubleshooting](./troubleshooting) page for proxy/CORS tips, session secret advice, volume permissions, and thumbnail/search behavior.

## How can I keep my deployment updated?
The app stores persistent state in the `/config` bind mount. Back up `/config/app-config.json` and `/config/app.db` before updating. Run `docker compose pull` and `docker compose up -d` to refresh the image, then verify volumes and settings in the UI.

## Who handles metadata and search indexing?
Thumbnails and ripgrep backed search results live in `/cache`. You can clear/recreate this mount without losing settings. If thumbnails aren't appearing, ensure FFmpeg/ffprobe are available (provided in the official image) and `FFMPEG_PATH`/`FFPROBE_PATH` point to valid binaries.

## How do I add support for custom file types in the editor?
The inline editor supports 50+ file types by default (txt, md, json, js, ts, py, yml, html, css, and many more). To add support for additional file extensions at runtime, set the `EDITOR_EXTENSIONS` environment variable with a comma-separated list:

```yaml
environment:
  - EDITOR_EXTENSIONS=toml,proto,graphql,dockerfile,makefile
```

Custom extensions are **added to** the default list (they don't replace it), and changes take effect immediately on container restart—no frontend rebuild required. See the [Environment Reference](../configuration/environment#editor) for details.
