# OIDC (OpenID Connect)

nextExplorer supports OIDC via Express OpenID Connect (EOC) and works with providers like Keycloak, Authentik, and Authelia.

Endpoints

- `/login` – Start login; accepts `?returnTo=/path` to redirect after auth
- `/callback` – Default OIDC callback path
- `/logout` – End session and (optionally) IdP logout

Environment

- `OIDC_ENABLED` – `true|false`
- `OIDC_ISSUER` – Provider issuer URL (discovery)
- `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` – Client credentials
- `OIDC_SCOPES` – Default `openid profile email`; add `groups`
- `OIDC_ADMIN_GROUPS` – Group names that grant `admin`
- If `OIDC_CALLBACK_URL` is not set, the app derives `${PUBLIC_URL}/callback` when `PUBLIC_URL` is provided

Admin mapping

- The app inspects `groups`, `roles`, and `entitlements` claims
- If any match an entry in `OIDC_ADMIN_GROUPS` (case‑insensitive), the user is `admin`; otherwise `user`

Keycloak (confidential client)

1. Clients → Create → `Client ID: nextexplorer`, Protocol: `openid-connect`
2. Settings: Access Type `confidential`; Valid Redirect URIs: `https://files.example.com/callback`
3. Credentials: copy Client Secret
4. Mappers: Add “Group Membership” mapper → Token Claim Name `groups` → Full group path OFF
5. Set env: `OIDC_ENABLED=true`, `OIDC_ISSUER=https://id.example.com/realms/main`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_SCOPES="openid profile email groups"`, `OIDC_ADMIN_GROUPS="next-admin admins"`

Authentik

1. Providers → OAuth2/OpenID → Create:
   - Authorization flow: `authorization_code`
   - Redirect URIs: `https://files.example.com/callback`
   - Enable “Include claims in id_token” (optional but convenient)
2. Applications → Create → Attach the provider; Confidential app
3. Claims/Scopes: Ensure `profile`, `email` are included; add a mapping for group membership to the `groups` claim (e.g., `member_of`)
4. Set env: `OIDC_ENABLED=true`, `OIDC_ISSUER=https://auth.example.com/application/o/next/`, client id/secret, scopes include `groups`, and `OIDC_ADMIN_GROUPS`

Authelia

1. In `configuration.yml` enable the OIDC provider and define a client:
   ```yaml
   identity_providers:
     oidc:
       enable: true
       # issuer_private_key: |
       #   -----BEGIN RSA PRIVATE KEY-----
       #   ...
       #   -----END RSA PRIVATE KEY-----
       clients:
         - client_id: 'nextexplorer'
           client_name: 'nextExplorer'
           client_secret: 'your-client-secret'
           public: false
           authorization_policy: 'one_factor'
           redirect_uris:
             - 'https://files.example.com/callback'
           scopes: ['openid','profile','email','groups']
           grant_types: ['authorization_code']
           response_types: ['code']
   ```
2. Set env: `OIDC_ISSUER=https://auth.example.com`, plus client id/secret and scopes

Compose example

```yaml
services:
  nextexplorer:
    image: nxzai/explorer:latest
    environment:
      - PUBLIC_URL=https://files.example.com
      - OIDC_ENABLED=true
      - OIDC_ISSUER=https://auth.example.com/application/o/next/
      - OIDC_CLIENT_ID=nextexplorer
      - OIDC_CLIENT_SECRET=your-client-secret
      - OIDC_SCOPES=openid profile email groups
      - OIDC_ADMIN_GROUPS=next-admin admins
```

Troubleshooting

- invalid redirect_uri – Ensure the redirect URI in your IdP is `${PUBLIC_URL}/callback`
- “Not authorized” after login – Verify `SESSION_SECRET` is set and stable; check cookies allowed in your proxy
- No admin privileges – Confirm your IdP sends `groups` (or `roles`/`entitlements`) and that `OIDC_ADMIN_GROUPS` matches
- Callback mismatch behind proxy – Set `PUBLIC_URL` to your external URL and confirm proxy forwards `X‑Forwarded‑*` headers
