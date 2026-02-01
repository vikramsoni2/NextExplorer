# OIDC Integration

nextExplorer uses Express OpenID Connect (EOC) to federate authentication with external providers. Configure these variables and your IdP once, and the app exposes `/login`, `/callback`, and `/logout` to manage the flow.

## Environment variables (see `backend/src/config/env.js`)

- `OIDC_ENABLED=true` enables the middleware.
- `OIDC_ISSUER` points to the IdP discovery URL (e.g., Keycloak realm or Authentik application base).
- `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` store client credentials.
- `OIDC_SCOPES` defaults to `openid profile email`; add `groups` if you want nextExplorer to inspect group claims.
- `OIDC_ADMIN_GROUPS` contains comma/space-separated group names that grant the admin role when present in `groups`, `roles`, or `entitlements` claims.
- `OIDC_REQUIRE_EMAIL_VERIFIED` (default `false`) — when `true`, requires the IdP to verify the user's email before allowing user creation or auto-linking. Some providers like newer versions of Authentik set `email_verified` to `false` by default; keep this setting as `false` to allow those users to log in.
- `OIDC_AUTO_CREATE_USERS` (default `true`) — when `false`, the user must already exist in the nextExplorer database (local or previously OIDC-linked), otherwise OIDC login is denied.
- Optional overrides: `OIDC_AUTHORIZATION_URL`, `OIDC_TOKEN_URL`, `OIDC_USERINFO_URL`, `OIDC_LOGOUT_URL`, and an explicit `OIDC_CALLBACK_URL` (defaults to `${PUBLIC_URL}/callback`).
  - `OIDC_LOGOUT_URL` — optional custom IdP logout URL. When set, logout requests redirect to this URL with a `post_logout_redirect_uri` parameter (OIDC standard). If not set, logout only clears the local session without redirecting to the IdP.

## Choosing authentication modes

Use `AUTH_MODE` to control which authentication methods are available:

- `AUTH_MODE=oidc` — **OIDC only**: The login page shows only the "Continue with Single Sign-On" button. Users cannot create local passwords.
- `AUTH_MODE=local` — **Local only**: The login page shows only username/password fields. OIDC is disabled even if `OIDC_ENABLED=true`.
- `AUTH_MODE=both` — **Dual authentication** (default): Users can choose between local login or SSO. The login page displays both options.
- `AUTH_MODE=disabled` — **No authentication**: Skips the login page entirely and makes all APIs public (same as `AUTH_ENABLED=false`).

## Flow overview

1. A user clicks “Continue with Single Sign-On” on the login page.
2. The app redirects to `${OIDC_AUTHORIZATION_URL}` or the issuer discovery endpoint.
3. After IdP authentication, the callback (`/callback`) is invoked, sessions are established, and the user lands back in the workspace.
4. Logout routes (`/logout`) tear down the session. If `OIDC_LOGOUT_URL` is configured, logout redirects to the IdP logout endpoint with a `post_logout_redirect_uri` parameter to complete the IdP logout flow. Otherwise, only the local session is cleared.

## Admin elevation

- nextExplorer inspects the `groups`, `roles`, and `entitlements` claims returned by the IdP.
- If any entry matches `OIDC_ADMIN_GROUPS` (case-insensitive), the user is promoted to admin.
- Without a match, the user receives the standard `user` role and only sees non-admin settings.

## Common troubleshooting

- **Invalid redirect URI**: Ensure your IdP’s redirect URI matches `${PUBLIC_URL}/callback` or the explicitly configured `OIDC_CALLBACK_URL`.
- **Sessions drop after restart**: Supply a stable `SESSION_SECRET` instead of letting the app generate one dynamically.
- **Not an admin after login**: Verify the IdP includes the expected group claim (e.g., `groups` scope) and that `OIDC_ADMIN_GROUPS` contains the group name exactly.
- **Cookies flagged Insecure**: Run the app over HTTPS (`PUBLIC_URL` must use `https`) and confirm your proxy forwards `X-Forwarded-Proto`/`Host` headers (see the Reverse Proxy guide).
