# ONLYOFFICE Integration

Use ONLYOFFICE Document Server to edit office files (DOCX, XLSX, PPTX, ODT, ODS, ODP) from within nextExplorer. The integration relies on server-to-server API calls and a shared JWT secret.

## Environment variables

| Variable                     | Required?         | Description                                                                               |
| ---------------------------- | ----------------- | ----------------------------------------------------------------------------------------- |
| `ONLYOFFICE_URL`             | Yes               | Public URL of your Document Server (e.g., `https://office.example.com`).                  |
| `PUBLIC_URL`                 | Yes               | nextExplorer’s public URL so ONLYOFFICE knows where to download files and post callbacks. |
| `ONLYOFFICE_SECRET`          | Yes               | JWT secret shared between nextExplorer and ONLYOFFICE for signing requests/responses.     |
| `ONLYOFFICE_LANG`            | No (default `en`) | Language code for the editor UI.                                                          |
| `ONLYOFFICE_FORCE_SAVE`      | No                | When true, users must use the editor’s Save button rather than relying on autosave.       |
| `ONLYOFFICE_FILE_EXTENSIONS` | No                | Comma-separated list of extensions you want to surface beyond the defaults.               |

## How it works

1. Opening a compatible file triggers a call to `/api/onlyoffice/config`, which returns editor configuration and a signed `config.token` when `ONLYOFFICE_SECRET` is set.
2. ONLYOFFICE fetches the file through `/api/onlyoffice/file?path=...` with an `Authorization: Bearer <config.token>` header.
3. After editing, ONLYOFFICE posts to `/api/onlyoffice/callback?path=...`, again authorized with the token; nextExplorer saves the changes automatically.

## Security notes

- Tokens are signed with HS256 using `ONLYOFFICE_SECRET`. Keep this secret in sync with the Document Server’s `services.CoAuthoring.secret` (`local.json`).
- To inspect the secret, run inside the Document Server container:
  ```bash
  jq -r '.services.CoAuthoring.secret.session.string' /etc/onlyoffice/documentserver/local.json
  ```
- Disable ONLYOFFICE JWT on the Document Server only if you completely trust the network; otherwise, mismatched tokens result in “document security token is not correctly configured.”
