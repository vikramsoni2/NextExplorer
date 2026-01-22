# Runtime Settings

In-app settings expose many server-side toggles you'll also find in the environment reference. Admin sections unlock once your user has the `admin` role or matches `OIDC_ADMIN_GROUPS`.

## Branding

Customize the appearance and branding of your nextExplorer instance:

- **Application name:** Display a custom name in the header, login page, and browser title (e.g., "SPRINTR" instead of "Explorer").
- **Logo upload:** Upload a custom logo (SVG, PNG, or JPG; max 2MB). Perfect size is 200×200px. Displays in the header and login page.
- **Attribution link:** Toggle the optional "Powered by nextExplorer" footer link. When enabled, users see a link crediting the original project.

## Files & Thumbnails

- **Enable thumbnails:** Toggle thumbnail generation (uses Sharp/FFmpeg). Disable to reduce CPU usage when browsing large volumes.
- **Thumbnail quality:** 1–100 (default 70) to control JPEG compression level.
- **Max dimension:** Longest side in pixels (default 200) for generated thumbnails.
- **Video previews:** Require FFmpeg/ffprobe; binaries are included but you can override paths via environment variables.

## Security & Authentication

- **Authentication toggle:** Turn on/off authentication for trusted, internal networks (not recommended for public deployments).
- **OIDC configuration:** The fields here mirror the environment variables in the reference section. Use them to enable SSO once you’ve configured your IdP.
- **Session locking:** Enable/disable workspace password prompts that gate the entire UI.

## Access Control

- **Rule editor:** Define per-folder rules with `path`, `type` (`rw`, `ro`, `hidden`), and recursion options.
- **First-match wins:** Rules are evaluated top to bottom; the first matching path governs browser behavior.
- **Hidden folders:** Use `hidden` to keep folders out of listings while still accessible via direct URLs.

## Admin Users

- **Create or edit local users:** Manage usernames, passwords, and roles (user vs admin).
- **Password reset:** Reset passwords for local accounts without needing direct OS access.
- **Admin safeguarding:** The UI prevents demoting or deleting the last admin to avoid lockouts.

## Additional hints

- Most settings persist in `/config/app-config.json`. Back up `/config` before making sweeping changes.
- Favorites and access control settings sync with the sidebar, so once you pin a favorite it surfaces immediately for all sessions.
