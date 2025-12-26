# Reverse Proxy & Networking

When exposing nextExplorer on a custom domain, a reverse proxy keeps the UI secure behind TLS while forwarding requests to the container. Use this guide to align `PUBLIC_URL`, trusted proxies, and CORS behavior.

## Key environment variables

| Variable                             | Purpose                                                                                                                                                                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_URL`                         | External URL (no trailing slash) used to set cookies, determine OIDC callbacks, and drive CORS defaults. Example: `https://files.example.com`.                                                                                            |
| `TRUST_PROXY`                        | Controls Express’s trust level; accepts `false`, a number (hops), or lists such as `loopback,uniquelocal`. If unset and `PUBLIC_URL` exists, defaults to `loopback,uniquelocal`. (`backend/config/trustProxy.js` documents this mapping.) |
| `CORS_ORIGIN(S)` / `ALLOWED_ORIGINS` | Explicit CORS origins when they differ from `PUBLIC_URL`. Defaults to the origin of `PUBLIC_URL` when provided.                                                                                                                           |

## Sample Nginx Proxy Manager block

- Point `files.example.com` to the container’s internal `3000` port.
- Enable WebSockets and preserve `X-Forwarded-*` headers (usually automatic).
- Terminate TLS at the proxy; nextExplorer marks cookies as `Secure` whenever `PUBLIC_URL` uses `https`.

## Trusted Proxy notes

- Default when `PUBLIC_URL` is set: `loopback,uniquelocal`, which trusts local or private Docker networks without opening up to the public internet.
- Override with values such as `1` (trust one hop) or CIDRs (`10.0.0.0/8,172.16.0.0/12`).
- Avoid `TRUST_PROXY=true` alone; the entrypoint maps it to `loopback,uniquelocal` for safety.

## CORS & headers

- Set `CORS_ORIGINS`/`ALLOWED_ORIGINS` when the app is accessed from multiple domains.
- Ensure the proxy forwards `X-Forwarded-Proto`, `X-Forwarded-Host`, and `X-Forwarded-For` so the backend derives the correct `PUBLIC_URL` origin and TLS state.

## Networking health checklist

- Proxy has TLS termination and forwards headers. Without headers, session cookies may appear as `Insecure`.
- POST, PUT, DELETE operations work through the proxy; test with uploads and metadata edits.
- If using OIDC, verify the IdP’s redirect URI matches `${PUBLIC_URL}/callback` or your manually supplied `OIDC_CALLBACK_URL`.

## Troubleshooting proxies

| Symptom                      | Fix                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| CORS errors                  | Add the proxy domain to `CORS_ORIGINS` or set `PUBLIC_URL`.                                    |
| Sessions drop                | Confirm `TRUST_PROXY` lets Express read `X-Forwarded-Proto` and `COOKIE` is not stripped.      |
| Redirect URI mismatch (OIDC) | Ensure the IdP redirect equals `${PUBLIC_URL}/callback` or the configured `OIDC_CALLBACK_URL`. |
