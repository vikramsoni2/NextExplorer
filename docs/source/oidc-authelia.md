# Authelia (OIDC) Setup

This guide configures Authelia as an OpenID Connect (OIDC) Identity Provider for nextExplorer. It’s tailored to this project’s backend, which uses Express OpenID Connect (EOC), and the environment variables supported in `backend/config/index.js`.

What you get
- Authorization Code flow with a confidential client
- Discovery via `/.well-known/openid-configuration` using `OIDC_ISSUER`
- Default callback at `/callback`
- Admin elevation based on OIDC group claims

Requirements
- Two hostnames (recommended): one for Authelia (e.g., `auth.example.com`), one for nextExplorer (e.g., `files.example.com`).
- TLS certificates on both (OIDC cookies are Secure over HTTPS).
- Docker and Docker Compose.

Terminology used below
- App URL: the externally reachable URL of nextExplorer (e.g., `https://files.example.com`).
- Issuer URL: the externally reachable base URL of Authelia (e.g., `https://auth.example.com`).

---

1) Stand up Authelia

You can run Authelia alongside your stack. The example below uses:
- Redis for session storage (recommended)
- SQLite for Authelia storage (simple single-node setup)
- File-backed users (local YAML) with groups to map nextExplorer admins

docker-compose for Authelia

```yaml
services:
  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - ./authelia/redis:/data

  authelia:
    image: authelia/authelia:latest
    container_name: authelia
    depends_on: [redis]
    environment:
      - TZ=UTC
    volumes:
      - ./authelia/config:/config
    ports:
      - "9091:9091"  # adjust or put behind a reverse proxy with TLS
    restart: unless-stopped
```

Create directory structure (on the host where you run the above compose):

```bash
mkdir -p authelia/config authelia/redis
```

Generate secrets
- JWT/session secrets and OIDC keys must be unique, long, and secret.

```bash
# 64-byte hex secrets
openssl rand -hex 64 > authelia/config/jwt_secret.txt
openssl rand -hex 64 > authelia/config/session_secret.txt
openssl rand -hex 64 > authelia/config/storage_encryption_key.txt

# OIDC issuer private key (RSA 2048)
openssl genrsa -out authelia/config/oidc_issuer_key.pem 2048
```

Create `authelia/config/users_database.yml` (example users with groups):

```yaml
users:
  alice:
    displayname: "Alice Example"
    password: "$argon2id$v=19$m=65536,t=3,p=2$REPLACE_ME_SALT$REPLACE_ME_HASH" # replace with a real hash
    email: alice@example.com
    groups:
      - users
      - next-admin
  bob:
    displayname: "Bob Example"
    password: "$argon2id$v=19$m=65536,t=3,p=2$REPLACE_ME_SALT$REPLACE_ME_HASH"
    email: bob@example.com
    groups:
      - users
```

Generate proper password hashes

```bash
# Inside the Authelia container or using the official image:
docker run --rm -it authelia/authelia:latest authelia hash generate argon2 --password 'S3cureP@ssw0rd'

# Replace the password fields above with the printed hash
```

Create `authelia/config/configuration.yml` (minimal, OIDC-focused):

```yaml
server:
  address: "tcp://:9091"

log:
  level: info

theme: auto

default_redirection_url: "https://files.example.com"  # your app URL

authentication_backend:
  file:
    path: /config/users_database.yml
    password:
      algorithm: argon2id

session:
  name: authelia_session
  same_site: Lax
  expiration: 1h
  inactivity: 5m
  remember_me_duration: 1M
  secret_file: /config/session_secret.txt
  redis:
    host: redis
    port: 6379

storage:
  local:
    path: /config/db.sqlite3
  encryption_key_file: /config/storage_encryption_key.txt

access_control:
  default_policy: one_factor

identity_providers:
  oidc:
    enable: true
    # HMAC used for introspection and ID Token signing metadata
    hmac_secret_file: /config/jwt_secret.txt
    issuer_private_key_file: /config/oidc_issuer_key.pem
    lifespans:
      id_token: 1h
      access_token: 1h
      refresh_token: 90d
    clients:
      - client_id: nextexplorer
        client_name: nextExplorer
        client_secret: "CHANGE_ME_STRONG_SECRET"
        # Standard confidential client using the Authorization Code flow
        public: false
        authorization_policy: one_factor
        redirect_uris:
          - "https://files.example.com/callback"  # prod
          # - "http://localhost:3000/callback"    # dev
        scopes:
          - openid
          - profile
          - email
          - groups
        grant_types:
          - authorization_code
          - refresh_token
        response_types:
          - code
        token_endpoint_auth_method: client_secret_basic
```

Notes
- Replace `files.example.com` with your real app domain.
- If testing locally without TLS, add `http://localhost:3000/callback` to `redirect_uris`.
- The `groups` scope enables a `groups` claim for admin mapping in nextExplorer.
- Authelia also supports `client_secret_post`; EOC works with `client_secret_basic` out of the box.

Start Authelia

```bash
docker compose up -d authelia redis
```

Verify discovery works

```bash
curl -fsSL https://auth.example.com/.well-known/openid-configuration | jq .issuer,.authorization_endpoint,.token_endpoint
```

---

2) Configure nextExplorer to use Authelia

Set environment variables for the backend (compose snippet below). The app derives the default callback `PUBLIC_URL + /callback` if `OIDC_CALLBACK_URL` is not set.

Compose snippet for nextExplorer

```yaml
services:
  nextexplorer:
    image: nxzai/explorer:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PUBLIC_URL=https://files.example.com
      - SESSION_SECRET=please-change-me
      - OIDC_ENABLED=true
      - OIDC_ISSUER=https://auth.example.com
      - OIDC_CLIENT_ID=nextexplorer
      - OIDC_CLIENT_SECRET=CHANGE_ME_STRONG_SECRET
      - OIDC_SCOPES=openid profile email groups
      - OIDC_ADMIN_GROUPS=next-admin admins
    volumes:
      - /srv/nextexplorer/cache:/cache
      - /srv/data/Projects:/mnt/Projects
      - /srv/data/Downloads:/mnt/Downloads
    restart: unless-stopped
```

Key behaviors (from the code)
- Callback path: EOC mounts `/login`, `/callback`, `/logout`. Default callback is `/callback`.
- Base URL: derived from `OIDC_CALLBACK_URL` origin, otherwise `PUBLIC_URL` (see `backend/app.js`).
- Cookies: marked `Secure` only when `PUBLIC_URL` (or callback URL) is HTTPS.
- Admin mapping: roles are derived from claims `groups`/`roles`/`entitlements`; if any intersect `OIDC_ADMIN_GROUPS`, user becomes `admin` (see `backend/services/users.js`).

Start nextExplorer

```bash
docker compose up -d nextexplorer
```

---

3) Test the flow

- Open the app URL and click “Continue with Single Sign‑On”.
- Authenticate with Authelia.
- On success, you’re redirected back to the app; the session is established.
- If your user is in `next-admin` (or any name listed in `OIDC_ADMIN_GROUPS`), you get admin capabilities.

Endpoints exposed by the backend
- `GET /login` – begins auth (also available as `GET /api/auth/oidc/login?redirect=/path`).
- `GET /callback` – OIDC callback (must be registered in Authelia).
- `GET /logout` – app session logout (IdP logout is not invoked by default).

---

4) Troubleshooting

- Redirect URI mismatch
  - Ensure Authelia `redirect_uris` contains the exact `${PUBLIC_URL}/callback` used by the app.

- Can’t discover endpoints / issuer mismatch
  - Set `OIDC_ISSUER` to the base URL of Authelia, e.g. `https://auth.example.com` (not the discovery path itself).

- Users don’t get admin
  - Include `groups` in both Authelia client `scopes` and `OIDC_SCOPES`.
  - Put users into a group named in `OIDC_ADMIN_GROUPS` (e.g., `next-admin`).

- Session seems to drop after restart
  - Set a stable `SESSION_SECRET` value so sessions persist across container restarts.

- Behind a reverse proxy
  - Set `PUBLIC_URL` to the external URL.
  - Ensure the proxy forwards `X-Forwarded-*` headers; nextExplorer configures `trust proxy` safely by default.

---

Appendix A: Minimal local-only setup

For a quick local evaluation without TLS:
1. Add `http://localhost:3000/callback` to the Authelia client `redirect_uris`.
2. Set `PUBLIC_URL=http://localhost:3000` in nextExplorer.
3. Keep `OIDC_ISSUER` pointing to your Authelia URL (e.g., `http://localhost:9091`).
4. Cookies will be non-Secure on HTTP; do not use this mode in production.

Appendix B: Mapping additional claims

nextExplorer reads `groups`, `roles`, and `entitlements`. If your organization uses a different claim name for group membership, map it in Authelia to one of those standard claim names.

References
- Authelia OIDC docs: https://www.authelia.com/integration/openid-connect/introduction/
- Express OpenID Connect: https://github.com/auth0/express-openid-connect
- Project OIDC config reference: see `README.md` and `docs/source/oidc.md`

