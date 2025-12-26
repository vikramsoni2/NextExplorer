# Authelia (OIDC) Setup

Authelia can act as the OIDC Identity Provider for nextExplorer using the Authorization Code flow. This guide shows how to stand up Authelia and connect it via environment variables.

## Authelia prerequisites

- Two hostnames (e.g., `auth.example.com` and `files.example.com`). Both should serve TLS.
- Docker Compose (Authelia + Redis stack) or an existing Authelia deployment.
- Secrets for JWT/session, storage encryption, and the Authelia OIDC issuer private key.

## Example Authelia stack

```yaml
services:
  redis:
    image: redis:7-alpine
    command: ['redis-server', '--appendonly', 'yes']
  authelia:
    image: authelia/authelia:latest
    depends_on: [redis]
    volumes:
      - ./authelia/config:/config
    ports:
      - '9091:9091'
```

Generate secrets (example commands):

```bash
openssl rand -hex 64 > authelia/config/jwt_secret.txt
openssl rand -hex 64 > authelia/config/session_secret.txt
openssl rand -hex 64 > authelia/config/storage_encryption_key.txt
openssl genrsa -out authelia/config/oidc_issuer_key.pem 2048
```

Create `authelia/config/configuration.yml` with an OIDC provider client (see the existing sections for scopes, redirect URIs, and grant types). Include `groups` in the scopes so nextExplorer can map admins.

## nextExplorer configuration

Add these variables to your nextExplorer service:

```yaml
environment:
  - PUBLIC_URL=https://files.example.com
  - SESSION_SECRET=please-change-me
  - OIDC_ENABLED=true
  - OIDC_ISSUER=https://auth.example.com
  - OIDC_CLIENT_ID=nextexplorer
  - OIDC_CLIENT_SECRET=CHANGE_ME_STRONG_SECRET
  - OIDC_SCOPES=openid,profile,email,groups
  - OIDC_ADMIN_GROUPS=next-admin,admins
```

The backend discovers `/login`, `/callback`, `/logout` automatically once OIDC is on. Admin elevation occurs when the user’s group claim intersects `OIDC_ADMIN_GROUPS`.

## Testing & validation

- Start Authelia and nextExplorer: `docker compose up -d authelia redis nextexplorer`.
- Visit `https://files.example.com`, click “Continue with Single Sign-On,” authenticate via Authelia, and confirm you return to the app.
- If you belong to `next-admin` (or whatever groups you configured), the `admin` role is granted automatically.

## Troubleshooting tips

| Symptom                     | Fix                                                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Redirect URI mismatch       | Ensure Authelia’s `redirect_uris` entry equals `${PUBLIC_URL}/callback` (or `OIDC_CALLBACK_URL` if overridden). |
| Users not admin             | Include the group claim in Authelia (via `groups` scope/mapping) and add the group name to `OIDC_ADMIN_GROUPS`. |
| Session issue after restart | Set a fixed `SESSION_SECRET` so the Express session stays valid.                                                |
| Behind proxy                | Set `PUBLIC_URL`, configure `TRUST_PROXY`, and forward `X-Forwarded-*` headers from your proxy.                 |
