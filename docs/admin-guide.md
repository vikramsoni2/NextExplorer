# Admin Guide

Initial setup

- On first launch, you’ll see the Setup screen to create a local admin user
- This account can manage users and settings; keep the password safe

User management

- Go to Settings → Admin → Users
- Create local users with initial passwords
- Grant admin role to trusted users
- Reset local user passwords and remove local users
- Safeguards: The last admin cannot be removed; demoting an admin is blocked

OIDC users and roles

- When OIDC is enabled, users are created automatically on first login
- Admin elevation is claim‑based: if the user’s `groups`/`roles`/`entitlements` contains any entry in `OIDC_ADMIN_GROUPS`, they become `admin`
- Without a match, OIDC users receive the `user` role

Access control

- Define folder rules in Settings → Access Control
- Use `hidden` to prevent specific paths from appearing in listings
- Use `ro` to allow browsing and downloading while preventing changes

Backups

- The `/cache` directory contains your settings, users DB, and thumbnails
- Back it up periodically; keep it mounted during upgrades

Suggested screenshots

- images/admin-users.png – Listing users and actions
- images/settings-access-control.png – Access rules in settings

