# Admin & Access Guide

Administrators control users, folders, and security policies through Settings. This guide walks through the workflows for onboarding admins, managing users, configuring access control, and ensuring data stays protected.

## First admin & workspace lock

- During first launch (after you run your Compose file) the Setup screen appears automatically. Create your first local user account and workspace password.
- That account becomes an admin automatically; the backend prevents removing or demoting the final admin.
- The workspace password protects the UI until a user unlocks it. Trusted sessions may remember the password for a short time depending on your session settings.

## User management

- Navigate to **Settings → Admin → Users** to add local users, assign roles, and reset passwords.
- When `USER_VOLUMES=true`, each user profile includes a **Volumes** tab for assigning per-user volumes. See [User volumes](/admin/user-volumes).
- Local users store credentials in the SQLite database inside your `/config` mount (see `backend/config/env.js`).
- Promote trusted accounts to admin inside the UI—note that demotions are blocked when it would remove the last admin.
- When OIDC is enabled, users are created automatically on first login and elevated to admin if their `groups`, `roles`, or `entitlements` claims match any of the names inside `OIDC_ADMIN_GROUPS`.

## Access control policies

- **Settings → Access Control** lets you define rules with the following types:
  - `rw` – Read/write access (default). Applies when no rule matches.
  - `ro` – Read-only access; uploads and edits are disabled.
  - `hidden` – Keeps the volume/folder out of listings; only accessible via direct path.
- Rules use the logical root (e.g., `Projects/Team`) and evaluate in defined order, so place more specific rules above general ones.
- Recursive rules apply to subfolders when the recursion checkbox is enabled.

## Sharing & guest access

- Users with access to a folder or file can create **share links** from the toolbar Share button; shares respect Access Control rules and can be read-only or read/write.
- **Anyone-with-link shares** can be opened by guests via `/share/:token` URLs; guests are confined to the shared path and cannot see other volumes or personal folders.
- **User-specific shares** require authentication and are visible from the **Shares → Shared with me** view; revoking a user’s access to the underlying path (via Access Control or account removal) effectively revokes their ability to use the link.

## Security & logging

- Authentication can be fully disabled for trusted networks via **Settings → Security**, but enabling protects all API routes.
- Session lockdown uses `SESSION_SECRET`; set this environment variable to ensure sessions persist across container restarts and multi-node deployments.
- Http logging toggles (`ENABLE_HTTP_LOGGING`, `LOG_LEVEL`, `DEBUG`) help surface suspicious activity; send container logs to a centralized system for audits.

## Backups & persistence

- `/config` houses `app.db`, `app-config.json`, and extension packages. Back these files up before upgrades or migrations.
- `/cache` contains generated thumbnails and search indexes that can be deleted if needed; the app recreates them as you browse.
- When upgrading, run `docker compose pull` followed by `docker compose up -d`; the entrypoint preserves `CONFIG_DIR` while migrating legacy `/cache` configs.
