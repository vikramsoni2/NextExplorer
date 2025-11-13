# nextExplorer

A modern, self-hosted file explorer with secure access control, polished UX, and a Docker-friendly deployment story.


## Feature Highlights
- Secure authentication with local users and optional OIDC SSO (multi‑user).
- Mount multiple host folders as top‑level volumes; browse, upload, move, rename, and delete.
- Fast media browsing with cached thumbnails and a built‑in image/video viewer.
- Inline text editing with syntax highlighting.
- Optional OnlyOffice integration for in‑browser editing of office docs (DOCX, XLSX, PPTX, ODF) with save‑back.
- Flexible UI: light/dark themes, grid/list views, resizable sidebar, breadcrumbs, and helpful tooltips.
- Powerful search in the current folder (file names and file contents via ripgrep).
- Right‑click context menu and drag‑and‑drop for quick file operations.
- Reverse‑proxy friendly with `PUBLIC_URL` and secure defaults.

## Screenshots
| | |
| --- | --- |
| ![Password creation screen showing Explorer branding and secure access badge](./docs/images/1.png) | ![Unlock modal prompting for the workspace password](./docs/images/2.png) |
| Lock the workspace with a master password before anyone can browse. | Re-enter the password to unlock trusted sessions. |
| ![Dark theme grid view of folders and mixed media files](./docs/images/3.png) | ![Light theme view of a project directory with files and folders](./docs/images/4.png) |
| Grid view keeps media heavy folders easy to scan. | Light theme works well for bright shared spaces. |
| ![Dark list view showing metadata like size and modified time](./docs/images/5.png) | ![Upload manager tracking progress for multiple files](./docs/images/6.png) |
| Detail view surfaces metadata like file size and timestamps. | Track multi-file uploads with per-item progress feedback. |

## Project Overview and Features

nextExplorer is a modern, self-hosted file explorer focused on secure access control and a polished user experience. It provides a web interface to browse and manage files on your own storage with a Docker‑friendly deployment.

- Secure authentication: local users by default; optional Single Sign‑On via OpenID Connect (OIDC). The first user created is an admin. When OIDC is enabled, users can sign in with SSO.
- Multiple volumes: mount multiple host directories as top‑level volumes; browse, upload, preview, move, and delete across all volumes from one UI.
- Intuitive UI: responsive layout, resizable sidebar, breadcrumbs, grid or list folder views, and light/dark themes.
- Thumbnail caching: images and videos get cached thumbnails for fast navigation of media‑heavy folders.
- File previews and editing: preview images/videos in‑app; double‑click text files to edit with an integrated, syntax‑highlighted editor.

## Usage Instructions

First‑Time Setup
1. Create Admin Account: After first launch, open the app in your browser and set up the first local admin username/password on the Setup screen.
2. Verify Volumes: Open the Volumes panel and ensure each mounted host directory under `/mnt` appears as a top‑level volume.
3. Start Exploring: Browse directories, upload files, create folders/files, and edit text files; image/video thumbnails are generated and cached automatically.

Sign‑In Options
- Local users: log in with the admin account you created (and any additional local users you add).
- OIDC SSO (optional): when configured, a “Continue with Single Sign‑On” option appears on the sign‑in screen.

Using the Application
- Sidebar and volumes: each host folder mounted under `/mnt` is a top‑level volume in the sidebar.
- File operations: right‑click any file/folder for actions (rename, delete, move, download, etc.). Drag and drop between folders is supported.
- Create: use the “New” menu to create files or folders directly from the browser.
- Upload: upload via the upload button or drag‑and‑drop; multiple uploads show per‑file progress.
- Search: find items by file name or by text inside files using the integrated ripgrep search within the current directory.
- Views and themes: toggle grid/list views and switch light/dark themes.
- Previews and editing: click images/videos to preview; click text/code files to open the inline editor with syntax highlighting and save back to disk.

## Deployment Guide

### Prerequisites
- Docker Engine 24+ and Docker Compose v2 installed on the host.
- One or more host directories to serve (these will be mounted into the container).
- A host directory for caching thumbnails and app settings (preferably SSD‑backed).
- Ensure the user that runs the container has read/write access to all of the above.

### Prepare host folders
Example layout:
- `/srv/nextexplorer/cache` – cache and settings storage
- `/srv/data/Projects` – example data volume
- `/srv/data/Media` – another data volume

### Docker Compose
Create a `docker-compose.yml` in your deployment directory:

```yaml
services:
  nextexplorer:
    image: nxzai/explorer:latest # Official nextExplorer image
    container_name: nextexplorer
    restart: unless-stopped
    ports:
      - "3000:3000"   # expose container port 3000 on the host
    environment:
      - NODE_ENV=production
      - PUBLIC_URL=http://localhost:3000
      - LOG_LEVEL=info          # use "debug" for verbose logging
      # - SESSION_SECRET=please-change-me       # optional static session secret
      # - PUID=1000                              # optional host user UID
      # - PGID=1000                              # optional host group GID
      # OIDC (optional): enable SSO, see OIDC section below
      # - OIDC_ENABLED=true
      # - OIDC_ISSUER=https://auth.example.com/realms/your-realm/
      # - OIDC_CLIENT_ID=nextexplorer
      # - OIDC_CLIENT_SECRET=your-client-secret
      # - OIDC_SCOPES=openid profile email groups
      # - OIDC_ADMIN_GROUPS=next-admin admins
      # OnlyOffice (optional): in‑browser editing for office docs
      # - ONLYOFFICE_URL=https://office.example.com
      # - ONLYOFFICE_SECRET=your-jwt-secret
      # - ONLYOFFICE_LANG=en
      # - ONLYOFFICE_FILE_EXTENSIONS=doc,docx,xls,xlsx,ppt,pptx,odt,ods,odp,rtf,txt,pdf
    volumes:
      - /srv/nextexplorer/cache:/cache   # cache & settings
      - /srv/data/Projects:/mnt/Projects # mount "Projects" volume
      - /srv/data/Media:/mnt/Media       # mount "Media" volume
```

Notes
- Port 3000 in the container is published to port 3000 on the host; adjust as needed.
- Environment variables configure nextExplorer (see Configuration below).
- Every subfolder under `/mnt` becomes a top‑level volume in the UI; add more by repeating `host_path:/mnt/Label` entries.

### Launch the container

```bash
docker compose up -d
```

The UI and API are available at `http://localhost:3000` (or your mapped host port).

### Optional: user/group mapping
To avoid permission issues on host volumes, run the app with your host user/group:
1. On the host, capture IDs: `id -u` and `id -g`.
2. Set `PUID` and `PGID` to those values in Compose.
3. Recreate/restart the container. Files created via nextExplorer will now have your host UID/GID.

### Updating

```bash
docker compose pull
docker compose up -d
```

User data and settings live in the mounted volumes (especially `/cache`) and persist across updates. The app never modifies the contents of your mounted data volumes unless you perform file operations in the UI.

## Configuration and Environment Variables

Core
- `PUBLIC_URL` – the fully qualified base URL where users access the app (e.g., `https://files.example.com`). Used to derive safe defaults for CORS, OIDC callback, and Express proxy trust.
- `NODE_ENV` – typically `production` for deployments.
- `PORT` – internal listen port (default `3000`). Usually leave as is and publish a different host port if needed.
- `SESSION_SECRET` – optional secret for session encryption. If omitted, a secure random secret is generated at startup. Set to a fixed value for stable sessions across restarts or replicas.

Storage and Volumes
- `VOLUME_ROOT` – container path for mounted volumes (default `/mnt`).
- `CACHE_DIR` – container path for cache and app data (default `/cache`). Map this to persistent, preferably fast storage.
- `PUID`, `PGID` – optional user and group IDs to run the app as, matching your host user/group to preserve file ownership.

Security and Networking
- `LOG_LEVEL` – `info` by default; set `debug` for verbose troubleshooting. Legacy `DEBUG=true` is also supported but prefer `LOG_LEVEL`.
- `CORS_ORIGINS` – optional comma‑separated allowed origins for cross‑site requests. When `PUBLIC_URL` is set, defaults to that origin; in development, all origins are allowed if unset.
- `TRUST_PROXY` – proxy trust configuration. When `PUBLIC_URL` is set and `TRUST_PROXY` is not, a safe default of `loopback,uniquelocal` is used. Override with a hop count or explicit CIDR list only if you understand your proxy chain.

Reverse Proxies
- If running behind Nginx/Traefik/a load balancer with TLS termination, set `PUBLIC_URL` to the external `https` URL. Cookies receive `Secure`, redirects and CORS are correct, and Express proxy trust is configured safely. Preserve `X‑Forwarded-*` headers in your proxy.

## Single Sign‑On (OIDC)

Enable OIDC to allow SSO with providers like Keycloak, Authentik, Authelia, Google, Azure AD.

Environment
- `OIDC_ENABLED` – `true` to enable OIDC.
- `OIDC_ISSUER` – issuer URL of your provider (used for discovery).
- `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` – client credentials for nextExplorer.
- `OIDC_SCOPES` – default `openid profile email`; include `groups` if you want group‑based admin mapping.
- `OIDC_ADMIN_GROUPS` – space or comma‑separated group names that grant admin role.
- Optional overrides: `OIDC_CALLBACK_URL`, `OIDC_AUTHORIZATION_URL`, `OIDC_TOKEN_URL`, `OIDC_USERINFO_URL` (usually unnecessary when discovery works).

Provider Setup
- Register a confidential client/app with Authorization Code flow.
- Redirect URI: `${PUBLIC_URL}/callback` (default). If you override `OIDC_CALLBACK_URL`, use that value.
- Include scopes: `openid profile email` and `groups` if applicable. Enable refresh tokens for persistent logins if desired.

How it works
- Login: UI triggers `GET /login`, which redirects to the provider. On success, the provider returns to `/callback` and the user is logged in.
- Logout: `GET /logout` ends the local session; IdP logout is optional.
- Admin mapping: group/role claims (`groups`, `roles`, `entitlements`) are inspected; if any match `OIDC_ADMIN_GROUPS` (case‑insensitive) the user is granted admin. Otherwise they are a regular user. Local admin users always retain admin access. Local and OIDC identities with the same email/username are merged on first login to avoid duplicates.

## ONLYOFFICE Integration (Document Editing)

Integrate an ONLYOFFICE Document Server to edit office documents in the browser (DOCX, XLSX, PPTX, ODF, etc.).

Environment
- `ONLYOFFICE_URL` – base URL of your Document Server (reachable from nextExplorer and able to reach nextExplorer’s `PUBLIC_URL`).
- `ONLYOFFICE_SECRET` – JWT secret shared with the Document Server (match `services.CoAuthoring.secret`); omit if JWT is disabled on the server.
- `ONLYOFFICE_LANG` – optional editor UI language (default `en`).
- `ONLYOFFICE_FORCE_SAVE` – optional `true|false` to force save on edits (default `false`).
- `ONLYOFFICE_FILE_EXTENSIONS` – optional comma list of extensions to open in OnlyOffice; nextExplorer has a sensible built‑in default.

Notes
- On open, nextExplorer builds a signed config for the Document Server and embeds the OnlyOffice editor in the UI. Supported backend routes include:
  - `POST /api/onlyoffice/config` – generate editor config for a file
  - `GET /api/onlyoffice/file` – token‑guarded file fetch for the Document Server
  - `POST /api/onlyoffice/callback` – save callback from the Document Server
- “Document security token is not correctly configured” usually indicates a secret mismatch. Ensure `ONLYOFFICE_SECRET` matches the Document Server’s JWT secret or disable JWT there.

## Logging & Debug Mode
- Default log level is `info`. Set `LOG_LEVEL=debug` for verbose diagnostics (HTTP request details, etc.).
- Inspect logs via `docker logs nextexplorer` (or your logging stack). Revert to `info` after debugging.

## Contributing

Pull requests are welcome. For development setup and guidelines, see `README-development.md`.
- Discuss major changes via an issue before opening a large PR.
- Add tests where practical and verify changes locally.
- When reporting issues, include logs, repro steps, and screenshots where relevant.

## Need Something Else?
- For local development, see `README-development.md`.
- Have a feature idea or found a bug? Open an issue.
