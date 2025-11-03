# Settings

Open Settings from the sidebar menu. Admin‑only sections are visible when your account has the `admin` role.

Authentication

- Enable authentication – When turned off, all API routes are public. Use only in trusted networks.
- OIDC configuration is set via environment variables (see Configuration). Admin elevation is controlled by `OIDC_ADMIN_GROUPS`.

Files & Thumbnails (Admin)

- Enable thumbnails – Turn off to reduce CPU/disk usage
- Thumbnail quality – 1 to 100 (default 70)
- Max dimension – Longest side in pixels (default 200)
- Notes: Images use sharp; video previews require FFmpeg/ffprobe which are included in the official image

Access Control (Admin)

- Add per‑folder rules with path, recursion, and permissions:
  - `rw` – Read/Write
  - `ro` – Read‑Only
  - `hidden` – Not visible in listings and cannot be accessed
- Rules are first‑match wins; paths are relative to the logical root (e.g., `Projects/Team`)

Admin Users

- Create local users, reset passwords, grant admin role
- You cannot demote an admin via the UI, and the backend prevents removing the last admin

Suggested screenshots

- images/settings-security.png – Toggle authentication
- images/settings-thumbnails.png – Thumbnail settings
- images/settings-access-control.png – Folder rules table
- images/admin-users.png – User management view

