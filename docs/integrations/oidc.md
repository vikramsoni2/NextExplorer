# OIDC Integration

nextExplorer uses Express OpenID Connect (EOC) to federate authentication with external providers. Configure these variables and your IdP once, and the app exposes `/login`, `/callback`, and `/logout` to manage the flow.

## Environment variables (see `backend/config/env.js`)

- `OIDC_ENABLED=true` enables the middleware.
- `OIDC_ISSUER` points to the IdP discovery URL (e.g., Keycloak realm or Authentik application base).
- `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` store client credentials.
- `OIDC_SCOPES` defaults to `openid profile email`; add `groups` if you want nextExplorer to inspect group claims.
- `OIDC_ADMIN_GROUPS` contains comma/space-separated group names that grant the admin role when present in `groups`, `roles`, or `entitlements` claims.
- Optional overrides: `OIDC_AUTHORIZATION_URL`, `OIDC_TOKEN_URL`, `OIDC_USERINFO_URL`, and an explicit `OIDC_CALLBACK_URL` (defaults to `${PUBLIC_URL}/callback`).

## Flow overview

1. A user clicks “Continue with Single Sign-On” on the login page.
2. The app redirects to `${OIDC_AUTHORIZATION_URL}` or the issuer discovery endpoint.
3. After IdP authentication, the callback (`/callback`) is invoked, sessions are established, and the user lands back in the workspace.
4. Logout routes (`/logout`) tear down the session; IdP logout is not invoked automatically but can be triggered via your IdP UI if needed.

## Admin elevation

- nextExplorer inspects the `groups`, `roles`, and `entitlements` claims returned by the IdP.
- If any entry matches `OIDC_ADMIN_GROUPS` (case-insensitive), the user is promoted to admin.
- Without a match, the user receives the standard `user` role and only sees non-admin settings.

## Common troubleshooting

- **Invalid redirect URI**: Ensure your IdP’s redirect URI matches `${PUBLIC_URL}/callback` or the explicitly configured `OIDC_CALLBACK_URL`.
- **Sessions drop after restart**: Supply a stable `SESSION_SECRET` instead of letting the app generate one dynamically.
- **Not an admin after login**: Verify the IdP includes the expected group claim (e.g., `groups` scope) and that `OIDC_ADMIN_GROUPS` contains the group name exactly.
- **Cookies flagged Insecure**: Run the app over HTTPS (`PUBLIC_URL` must use `https`) and confirm your proxy forwards `X-Forwarded-Proto`/`Host` headers (see the Reverse Proxy guide).
