# Permissions refactor TODO (research-first)

Status: refactor in progress — keep changes small and behavior-preserving.

## Goal

Make authorization understandable and consistent across:

- Roles: `admin`, `user` (and “guest sessions” for shares)
- Spaces: volumes, personal folders (`USER_DIR_ENABLED`), share paths
- Actions: browse/list, read, write, upload, delete, create folder, rename, download, share-create

The outcome should be **one permission oracle** used by all routes, with a small number of well-tested policy rules.

## Current implementation (quick map)

- Central policy (best candidate “source of truth”): `backend/src/services/accessManager.js`
- Global path rules (`rw|ro|hidden`) stored in settings: `backend/src/services/accessControlService.js`
- Guest session attachment + precedence rules: `backend/src/middleware/authMiddleware.js`
- Path space parsing (magic first segment): `backend/src/utils/pathUtils.js`
- Share endpoints + share-browse: `backend/src/routes/shares.js`
- Main browse endpoint: `backend/src/routes/browse.js`
- Frontend uses `/api/browse/*` for normal paths and `/api/share/:token/browse/*` for share paths: `frontend/src/stores/fileStore.js`

## Invariants we must preserve (confirm in product)

- [x] Confirm desired behavior when `USER_DIR_ENABLED=true`:
  - Today it **adds** `personal/*` space; it does **not** restrict volumes.
  - Do we want a “personal-only” mode for non-admins? If yes, define it explicitly.
- [ ] Admin bypass: admin can override `ro` but not `hidden` (current behavior in `accessManager`).
- [ ] Guests can only access `share/<token>/...`, never `volume/*` or `personal/*`.
- [ ] Share write access is the intersection of (share accessMode) AND (underlying source permissions).
- [ ] Authenticated user should take precedence over a stale guest session (current middleware behavior).

## Known inconsistencies / bugs (to fix during refactor)

- [x] Replace route-local checks that only use `getPermissionForPath()` (path rules) with `accessManager` decisions:
  - `backend/src/routes/files/utils.js` (`assertWritable`)
  - `backend/src/routes/files/transfer.js` (pre-checks for copy/move)
  - `backend/src/routes/search.js` (hidden filtering)
- [x] Fix `/api/browse/*` hidden filtering: it currently calls `getPermissionForPath()` on `share/<token>/...` paths, which do not match underlying volume rules. See `backend/src/routes/browse.js`.
- [x] Fix `/api/share/:token/browse/*` directory listing to enforce hidden rules per child (currently no hidden filtering). See `backend/src/routes/shares.js`.
- [x] Decide and document reserved namespace collisions: volume/user-volume labels named `personal`, `share`, or `volumes` are treated as special path spaces. See `backend/src/utils/pathUtils.js`.
- [x] Remove or gate noisy debug logging in `resolveLogicalPath` / `resolveSharePath` / auth middleware.

## Refactor approach (high-level)

### A. Make authorization a single “decision” API

- [x] Define `Action` enum (at least): `list`, `read`, `write`, `delete`, `upload`, `createFolder`, `rename`, `download`, `createShare`.
- [ ] Define `Principal` shape: `{ kind: 'user', user, roles } | { kind: 'guest', guestSession }`.
- [ ] Define `ResourceRef` shape: `{ space, logicalPath }` and ensure “space” is explicit in all internal code paths.
- [x] Implement `authorize(context, logicalPath, action) -> { allowed, reason, effectiveMode, shareInfo?, resolved? }`
  - `resolvePathWithAccess()` can remain, but should be layered under a single authorizer that is used everywhere.
- [x] Ensure “child listing” can be authorized efficiently (bulk / cached rules), not N+1 DB queries.

### B. Consolidate browse/listing logic

- [x] Create a shared service function like `listDirectory(context, logicalPath)` that:
  - resolves the directory via the authorizer
  - lists children
  - applies per-child visibility rules using the **underlying** paths (including share-underlying rules)
  - returns consistent `items[] + access + shareInfo`
- [x] Update routes to use it:
  - `/api/browse/*` (volume/personal)
  - `/api/share/:token/browse/*` (share)
- [x] Ensure share browse continues to support “file shares as virtual one-item directories” (frontend relies on this).

### C. Remove duplicated / contradictory checks in routes

- [ ] For each file mutation endpoint, require authorization via a single helper:
  - upload (`backend/src/services/uploadService.js`)
  - create folder, rename, move/copy, delete, zip compress/extract, editor save, chmod/chown
- [ ] Standardize error mapping:
  - unauthorized vs forbidden vs not found (avoid leaking existence when `hidden`)

### D. Make path spaces explicit (optional, but recommended)

- [ ] Introduce explicit path prefixes to avoid collisions:
  - Example: `uv/<userVolumeId>/...` instead of using a mutable label as the first segment.
- [x] If keeping current format, add validation to prevent user-volumes from using reserved names (`personal`, `share`, `volumes`).

## Step-by-step TODO list (execution order)

### 0) Lock down expected behavior (must do first)

- [ ] Write a short “Permissions Spec” section below with examples for:
  - admin vs user vs guest
  - `USER_DIR_ENABLED` on/off
  - `USER_VOLUMES` on/off
  - share anyone/users + readonly/readwrite
- [ ] Identify which endpoints should treat denied access as 404 vs 403 (privacy / hiding).

### 1) Add tests to capture current behavior (before changing internals)

- [ ] Add/extend backend tests for:
  - [ ] browse: hidden rules under share paths (should hide underlying hidden children)
  - [ ] browse: hidden rules under non-share paths
  - [ ] copy/move/delete: share paths obey share + underlying permissions
  - [ ] admin vs `ro` path behavior
  - [ ] guest cannot access non-share spaces

### 2) Introduce central authorization helpers (no route changes yet)

- [x] Add a new module (or extend `accessManager`) with:
  - `authorizePath(context, logicalPath, action)`
  - `authorizeListingChild(context, parentResolved, childName)` (or similar)
- [x] Add caching strategy for repeated `getPermissionForPath()` calls during listings.

### 3) Migrate browse endpoints to shared listing

- [x] Implement `listDirectory()` service
- [x] Switch `backend/src/routes/browse.js` to use it
- [x] Switch `backend/src/routes/shares.js` browse handler to use it
- [x] Confirm frontend still works (share browsing uses `/api/share/:token/browse/*`).

### 4) Migrate mutation endpoints (one-by-one)

- [x] upload path auth (`backend/src/services/uploadService.js`)
- [x] folder create (`backend/src/routes/files/folder.js`)
- [x] rename (`backend/src/routes/files/rename.js`)
- [x] transfer copy/move (`backend/src/services/fileTransferService.js` + route wrappers)
- [x] delete (`backend/src/services/fileTransferService.js` + route wrapper)
- [x] zip extract/compress (`backend/src/routes/zip.js`)
- [x] editor save (`backend/src/routes/editor.js`)
- [x] chmod/chown (`backend/src/routes/permissions.js`)

### 5) Delete dead/duplicate helpers and normalize responses

- [x] Remove `assertWritable()` usage (or re-implement it on top of the authorizer).
- [x] Remove route-level `getPermissionForPath()` checks where redundant.
- [ ] Normalize the “access metadata” response shape across browse endpoints.

## Progress log

- 2026-02-01: Added `backend/src/services/directoryListingService.js` and switched `/api/browse/*` + `/api/share/:token/browse/*` to it; removed `assertWritable` and other route-local permission prechecks; aligned search filtering with `accessManager`; all backend tests passing.

### 6) Cleanup and hardening

- [x] Remove debug logs or guard behind `DEBUG` config.
- [x] Add docs: env flags (`USER_DIR_ENABLED`, `USER_VOLUMES`) + expected behavior.
- [x] Ensure reserved path collisions are prevented or explicitly supported.

## Permissions Spec (to be filled)

### Env flags

- `USER_DIR_ENABLED=true`: enables `personal/*` space (per-user filesystem root). Does **not** restrict volume access.
- `USER_VOLUMES=true`: non-admin users can only access assigned user-volumes (by label); admin bypasses this and sees all volume roots.

### Role / principal behavior (current)

- Admin user:
  - Volumes: can read/write even if global rule says `ro`; cannot access paths marked `hidden`.
  - Shares: can access shares as a normal authenticated user, subject to share recipient rules (for `sharingType=users`) and expiry.
- Regular user:
  - Volumes: full access unless global rule says `ro`/`hidden`, and (if `USER_VOLUMES=true`) only inside assigned user-volumes.
  - Personal: full access to their own `personal/*` space.
- Guest session:
  - Only `share/<token>/...` space is accessible.
  - Cannot create shares, cannot access volumes, cannot access personal.

### Shares (current)

- Anyone share:
  - Requires guest session OR authenticated user.
  - Effective write is `share.accessMode === 'readwrite'` AND underlying source is not read-only/hidden.
- User-specific share:
  - Requires authenticated user AND share permission.

### `hidden` handling (current, not yet normalized)

- Browse endpoints tend to treat denied access as “not found” (404-style) in some places, while metadata/editor generally return forbidden (403-style).
- TODO: decide and normalize when we want 404 vs 403 for hidden/denied across the API.
