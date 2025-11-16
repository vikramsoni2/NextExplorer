# Features

nextExplorer mixes a modern browser experience with secure access controls and filesystem workflows. Here are the standout capabilities available out of the box.

## File browsing & previews
- **Dual views:** Switch between responsive grid, list, and column modes while keeping breadcrumbs, toolbar, and search accessible.
- **Inline previews:** Images, videos, PDFs, and text files preview instantly without downloads. Image/video thumbnails are generated automatically using FFmpeg (`FFMPEG_PATH`/`FFPROBE_PATH` can override binaries).
- **Drag-and-drop:** Move files or folders directly inside the UI and upload from your desktop via drag-and-drop.
- **Context menus:** Right-click the background or individual items for quick shortcuts (New Folder/File, Paste, Rename, Get Info, download, delete).

## Editing & document workflows
- **Built-in editor:** Double-click any text or code file to edit it inline with syntax highlighting, line numbers, and Save/Cancel actions. Supports 50+ file types by default (txt, md, json, js, ts, py, yml, html, css, and many more). Extend support for additional formats at runtime using the `EDITOR_EXTENSIONS` environment variable—no rebuild required.
- **ONLYOFFICE integration:** When `ONLYOFFICE_URL` and the JWT `ONLYOFFICE_SECRET` are configured, docx/xlsx/pptx/odt/ods/odp files open with co-editing capabilities via `/api/onlyoffice/*` endpoints.
- **Favorites:** Pin folders to the sidebar with a star so critical paths stay in reach across sessions.

## Search & metadata
- **Smart search:** The search bar uses ripgrep under the hood (enable or disable via `SEARCH_RIPGREP`, `SEARCH_DEEP`, and `SEARCH_MAX_FILESIZE`) to find filenames and contents inside the current folder and its children.
- **Metadata overlays:** List view shows size, kind, modified date, owner, and volume stats (volume usage visibility flips on with `SHOW_VOLUME_USAGE`).
- **Thumbnail cache:** `/cache` holds thumbnails and search indexes that regenerate when cleared.

## Access & security
- **Local users & groups:** Create local accounts from Settings → Admin; the first account becomes admin and can’t be removed while others exist.
- **OIDC SSO:** Express OpenID Connect exposes `/login`, `/logout`, and `/callback`, so you can federate with Keycloak, Authentik, Authelia, or any compliant provider. Admin elevation happens when the IdP groups/roles intersect `OIDC_ADMIN_GROUPS`.
- **Workspace lock:** A workspace password (set on first run) gates access, and admin-only sections (Files & Thumbnails, Security, Access Control, Admin Users) appear only when your role allows it.

## Operational helpers
- **Resizeable sidebar:** The sidebar can be dragged to different widths for wide or narrow monitors.
- **Notifications & uploads:** A floating footer panel tracks uploads, providing pause/resume/cancel controls plus multi-file progress.
- **Keyboard shortcuts:** ⌘/Ctrl+C/X/V for clipboard actions, plus quick navigation via breadcrumbs and toolbar icons.
