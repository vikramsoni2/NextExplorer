# Running Behind a Reverse Proxy (e.g., Nginx Proxy Manager)

When placing nextExplorer behind a reverse proxy and a custom domain, set a single environment variable and the app will derive everything it needs:

- `PUBLIC_URL` – the fully-qualified public URL for your app (no trailing slash). Example: `https://files.example.com`

What it controls:
- CORS allowed origin defaults to the origin of `PUBLIC_URL` unless you explicitly set `CORS_ORIGINS`.
- OIDC callback URL defaults to `PUBLIC_URL + /callback` unless you explicitly set `OIDC_CALLBACK_URL`.
- Express configures a safe `trust proxy` default when `PUBLIC_URL` is provided (can be overridden with `TRUST_PROXY`).

Compose example:

```yaml
services:
  nextexplorer:
    image: nxzai/explorer:latest
    environment:
      - NODE_ENV=production
      - PUBLIC_URL=https://files.example.com
      # Optional: override or add more CORS origins
      # - CORS_ORIGINS=https://files.example.com,https://admin.example.com
      # Optional: override OIDC callback if you need a non-default path
      # - OIDC_CALLBACK_URL=https://files.example.com/custom/callback
    ports:
      - "3000:3000"  # or run without publishing and let the proxy connect the container network
```

Nginx Proxy Manager tips:
- Point your domain to the container’s internal port 3000.
- Enable Websockets and preserve `X-Forwarded-*` headers (enabled by default in NPM).
- Terminate TLS at the proxy; nextExplorer will treat cookies as Secure in production.

### Trust Proxy settings

- Default: When `PUBLIC_URL` is set and `TRUST_PROXY` is not, the app sets `trust proxy` to `loopback,uniquelocal`. This trusts only local/private reverse proxies (Docker/Traefik/Nginx on RFC1918/loopback ranges) and avoids the security risk of trusting arbitrary clients.
- Override: Set `TRUST_PROXY` explicitly for your topology. Supported values:
  - `false` – disable trusting proxies (Express default).
  - A number (e.g. `1`, `2`) – trust that many hops in `X-Forwarded-For`.
  - A string list – e.g. `loopback,uniquelocal` or CIDRs/IPs like `10.0.0.0/8,172.16.0.0/12,192.168.0.0/16`.
- Note: `TRUST_PROXY=true` is not accepted as-is; it is mapped to `loopback,uniquelocal` to prevent IP spoofing and satisfy `express-rate-limit` safety checks.
