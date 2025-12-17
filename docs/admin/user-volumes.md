# User volumes (per-user volume assignments)

When `USER_VOLUMES=true`, nextExplorer stops showing *all* mounted volumes to everyone. Admins still see all volumes under `VOLUME_ROOT`, but regular users only see volumes explicitly assigned to them by an admin.

## Enable the feature

Set the environment variable and restart the container:

```bash
USER_VOLUMES=true
```

## What changes when enabled

- **Admins**: continue to see all volumes mounted under `VOLUME_ROOT` (default `/mnt`).
- **Non-admin users**: the root volume list is filtered down to only the volumes assigned to their user profile.
- **No assignments = no volumes**: if a user has no assigned volumes, they’ll see an empty volume list.

## Assign volumes to a user (admin)

1. Go to **Settings → Admin → Users**.
2. Click a user (or create a new one).
3. Open the **Volumes** tab.
4. Click **Add volume**, browse to a directory, choose an access mode, and save.  
  
![Add volume dialog](/images/user-volumes-2.png)  
  
![User profile volumes tab](/images/user-volumes-1.png)

### Volume fields

- **Label**: the name the user sees in the sidebar (must be unique per user).
- **Directory**: an existing directory path on the server/container (must be readable by the container user).
- **Access mode**:
  - `readwrite`: user can upload, create folders, rename, move, and delete.
  - `readonly`: user can browse and download, but cannot modify content.


## Notes & interactions

- **Directory picker**: the admin directory browser starts at `VOLUME_ROOT`, hides dot-directories, and excludes reserved names like `_users`.
- **Access Control still applies**: if Access Control marks a path `ro` or `hidden`, that restriction also applies on top of the user volume assignment.
- **Persistence**: assignments are stored in the SQLite DB under `CONFIG_DIR` (`/config` by default).

## Troubleshooting

- **Volumes tab missing**: confirm `USER_VOLUMES=true` and refresh the app (feature flags are loaded from `/api/features`).
- **User can’t see a volume**: verify the user has an assigned volume, and that the chosen label matches what they’re navigating to.
- **“Path does not exist or is not accessible”**: the server process inside the container can’t `stat()` the directory; fix mount/permissions and try again.
