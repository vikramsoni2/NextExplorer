# Upload Pipeline Overview

This project supports two parallel upload strategies:

- `POST /api/upload` (legacy) uses the custom Multer-backed pipeline in `services/uploadService.js`.
- `POST / PATCH / HEAD / OPTIONS / DELETE /api/uploads/tus` (new) implements the [tus.io](https://tus.io/) resumable upload protocol via `services/tusService.js`.

The tus implementation is the preferred option for all new clients because it offers resumable, chunked uploads and better recovery from network drops.

## Architecture

- `services/tusService.js` sets up `@tus/server` with an `@tus/file-store` datastore.
- Chunks and metadata are persisted under the cache tree (`directories.tusUploads`). By default this resolves to `${CACHE_DIR:-/cache}/tus-uploads`.
- The tus router is mounted **after** auth middleware in `app.js`, so requests must include the same Bearer token as the rest of the API.
- Once an upload completes (`onUploadFinish` hook):
  - Metadata supplied by the client determines the target volume (`uploadTo`) and relative path (`relativePath`).
  - The finished file is moved from the tus cache to the real volume using the existing `pathUtils` helpers.
  - Name collisions in the destination folder are resolved by `findAvailableName` (e.g. `filename (1).ext`).
  - The temporary tus metadata JSON is cleaned up to keep the cache lean.

## Client Requirements

- Clients **must** set the `Authorization: Bearer <token>` header on every request (POST, PATCH, HEAD).
- `Tus-Resumable: 1.0.0` is required on all non-OPTIONS requests, as per the tus protocol.
- Useful metadata keys (all sent via the standard `Upload-Metadata` header):
  - `uploadTo` – existing folder path that already passed through `normalizePath` on the frontend.
  - `relativePath` – desired filename or nested folder path relative to `uploadTo`.
  - `name` – optional fallback used when the client cannot provide a relative path.

Example Uppy configuration (see `frontend/src/composables/fileUploader.js`):

```js
uppy.use(Tus, {
  endpoint: `${apiBase}/api/uploads/tus`,
  retryDelays: [0, 1000, 3000, 5000],
});

uppy.on('file-added', (file) => {
  uppy.setFileMeta(file.id, {
    uploadTo: normalizePath(fileStore.currentPath || ''),
    relativePath: file.meta?.relativePath || file.name,
  });
});
```

## Operational Notes

- The backend ensures `directories.cache`, `directories.thumbnails`, and `directories.tusUploads` exist during boot.
- Temporary files remain in the tus cache until an upload finalises successfully. If a client never resumes, cleanup can be triggered via `tusServer.datastore.deleteExpired()` when expiration is configured.
- Reverse proxies must allow the full method set (`POST`, `PATCH`, `HEAD`, `OPTIONS`, `DELETE`) and support long-lived/large-body requests on `/api/uploads/tus`.
- The legacy Multer endpoint remains available for compatibility, but plan to retire it once clients migrate to tus.

## Local Testing Checklist

1. Run `npm start` in `backend/` and initiate a tus upload from the frontend.
2. Pause your network (or kill the tab) mid-transfer, then resume to confirm upload recovery.
3. Inspect the target volume to verify the uploaded file is renamed correctly on completion.
4. Check `cache/tus-uploads` for stale files; they should disappear once the move succeeds.
