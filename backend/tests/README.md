# Backend Test Suites

## Layout

- `routes/` — endpoint-level suites that mount Express routers and exercise HTTP flows (auth, features, upcoming search/files routes).
- `services/` — business logic, storage, and configuration helpers (users, settings, access control, etc).
- `utils/` — low-level utilities such as `pathUtils` that enforce safe file operations and normalization.
- `helpers/` — shared fixtures or helpers (e.g., `env-test-utils`) used across suites.

Keep file names aligned with the code under test (e.g., `services/settings.test.js` targets `src/services/settingsService.js`).

## Writing a New Test

1. Pick the appropriate domain folder (`routes`, `services`, or `utils`).
2. Use `node:test` + `assert` (matching the existing pattern) and keep suites focused on one module/feature.
3. Reuse the environment helper (`helpers/env-test-utils.js`) to create transient config/cache/volume directories, reset `process.env`, and clear module caches. This keeps migrations/setup deterministic.
4. Clean up async resources via `await envContext.cleanup()` or `test.after`.

## Running the Suite

```sh
cd backend
npm test
```

`npm test` executes all files under `backend/tests` via `node --test`. The suite already applies SQLite migrations before each run, so expect a brief migration phase at the start of the output.
