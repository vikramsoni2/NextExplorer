#!/bin/bash
set -e

# Provide sensible defaults to avoid surprises on first run.
PUID=${PUID:-1000}
PGID=${PGID:-1000}

# Ensure the base appuser exists before attempting modifications.
if ! id appuser >/dev/null 2>&1; then
  echo "ERROR: Expected user 'appuser' to be present in the image."
  exit 1
fi

CURRENT_UID=$(id -u appuser)
CURRENT_GID=$(id -g appuser)

# Update user/group IDs only when they differ from the requested values.
if [ "$CURRENT_UID" != "$PUID" ] || [ "$CURRENT_GID" != "$PGID" ]; then
  echo "INFO: Updating appuser UID:GID from ${CURRENT_UID}:${CURRENT_GID} to ${PUID}:${PGID}"
  groupmod -o -g "$PGID" appuser
  usermod -o -u "$PUID" appuser
fi

# Fix ownership on key directories that map to host volumes.
for path in /app /cache; do
  if [ -e "$path" ]; then
    chown -R appuser:appuser "$path"
  fi
done

echo "INFO: Launching process as appuser (${PUID}:${PGID})"
exec gosu appuser "$@"
