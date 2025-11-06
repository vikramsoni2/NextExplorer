ONLYOFFICE Integration

This app integrates ONLYOFFICE Document Server for editing Office files (docx, xlsx, pptx, odt, ods, odp, etc.). Double‑clicking a supported file opens it in an embedded editor, with changes saved back to storage.

Server configuration

- Set environment variables on the backend:
  - `ONLYOFFICE_URL` – public URL of your Document Server, e.g. `https://office.vsoni.com`.
  - `PUBLIC_URL` – public base URL of this app, e.g. `https://files.example.com`. The Document Server fetches files and posts callbacks to this origin.
  - `ONLYOFFICE_SECRET` – Document Server JWT secret (must match DS `services.CoAuthoring.secret`). Used to sign `config.token` and verify DS requests.

Routes

- `POST /api/onlyoffice/config` – returns editor config for a file (requires user session). When `ONLYOFFICE_SECRET` is set, responds with `config.token` signed with HS256.
- `GET /api/onlyoffice/file?path` – Document Server downloads the file. Expects `Authorization: Bearer <config.token>` (or `?token=`).
- `POST /api/onlyoffice/callback?path` – Document Server posts save callbacks. Expects `Authorization: Bearer <config.token>` (or `?token=`).

Notes

- Ensure the Document Server can reach `PUBLIC_URL` over the network.
- If you see “document security token is not correctly configured”, set `ONLYOFFICE_SECRET` to the exact DS secret or disable JWT on the DS.

Finding the DS JWT secret

- Docker shell into the DS container, then run one of the following (paths can vary by build):
  - `jq -r '.services.CoAuthoring.secret.session.string' /etc/onlyoffice/documentserver/local.json`
  - or `jq -r '.services.CoAuthoring.secret' /etc/onlyoffice/documentserver/local.json`
- Check if JWT is enabled: `jq -r '.services.CoAuthoring.token.enable' /etc/onlyoffice/documentserver/local.json`
