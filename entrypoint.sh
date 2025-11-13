#!/bin/bash
set -e

# Provide sensible defaults to avoid surprises on first run.
PUID=${PUID:-1000}
PGID=${PGID:-1000}

CONFIG_DIR=${CONFIG_DIR:-/config}
CACHE_DIR=${CACHE_DIR:-/cache}

# Detect history and gently migrate persistent files to the config directory.
persisted_items=(
  "app.db"
  "db.sqlite"
  "app-config.json"
  "settings.yaml"
  "extensions"
  "extensions/icons"
  "extensions/brand"
)

ensure_dir() {
  mkdir -p "$1"
}

migrate_item() {
  local rel_path="$1"
  local src="${CACHE_DIR}/${rel_path}"
  local dst="${CONFIG_DIR}/${rel_path}"

  if [ -e "$src" ] && [ ! -e "$dst" ]; then
    ensure_dir "$(dirname "$dst")"
    mv "$src" "$dst"
    echo "INFO: Migrated ${rel_path} to ${CONFIG_DIR}"
  fi

  if [ -e "$dst" ] && [ ! -e "$src" ]; then
    ensure_dir "$(dirname "$src")"
    ln -s "$dst" "$src"
    echo "INFO: Created compatibility link ${src} -> ${dst}"
  fi
}

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

# Guarantee every host-facing directory exists before touching it.
ensure_dir "/app"
ensure_dir "$CONFIG_DIR"
ensure_dir "$CACHE_DIR"
ensure_dir "${CACHE_DIR}/thumbnails"
ensure_dir "${CONFIG_DIR}/extensions"
ensure_dir "${CONFIG_DIR}/extensions/icons"
ensure_dir "${CONFIG_DIR}/extensions/brand"

for rel in "${persisted_items[@]}"; do
  migrate_item "$rel"
done

# Fix ownership on key directories that map to host volumes.
for path in /app "$CONFIG_DIR" "$CACHE_DIR"; do
  if [ -e "$path" ]; then
    chown -R appuser:appuser "$path"
  fi
done

echo "INFO: Launching process as appuser (${PUID}:${PGID})"
exec gosu appuser "$@"
