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
    environment:
      - NODE_ENV=production
      - PUBLIC_URL=http://localhost:3000
      # Optional: keep sessions stable across restarts
      # - SESSION_SECRET=please-change-me
      # Optional: run as your host UID/GID for file ownership
      # - PUID=1000
      # - PGID=1000
      # Optional OIDC (SSO)
      # - OIDC_ENABLED=true
      # - OIDC_ISSUER=https://auth.example.com/application/o/next/
      # - OIDC_CLIENT_ID=nextexplorer
      # - OIDC_CLIENT_SECRET=...
      # - OIDC_SCOPES=openid profile email groups
      # - OIDC_ADMIN_GROUPS=next-admin admins
    volumes:
      - ./config:/config
      - ./cache:/cache
      # Each /mnt/<Label> mount becomes a top-level volume in the UI
      - /path/to/your/files:/mnt/Files
```

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
