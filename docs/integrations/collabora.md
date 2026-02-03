# Collabora (CODE) Integration

Use **Collabora Online (CODE)** to view and edit office files inside nextExplorer using the **WOPI** protocol.

## Requirements

- A Collabora CODE server reachable by the user’s browser (e.g. `https://collabora.example.com`).
- nextExplorer must have a correct `PUBLIC_URL` (Collabora calls back to your app using this).
- Your reverse proxy in front of Collabora must support **WebSockets** (this is the most common cause of “socket connection closed unexpectedly” errors).

## Environment variables (nextExplorer backend)

| Variable                    | Required?         | Description                                                                                                      |
| --------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `COLLABORA_URL`             | Yes               | Public base URL of Collabora (e.g. `https://collabora.example.com`).                                             |
| `PUBLIC_URL`                | Yes               | Public base URL of nextExplorer (e.g. `https://files.example.com`). Used to build the WOPI URLs Collabora calls. |
| `COLLABORA_SECRET`          | Yes               | Shared JWT secret used to sign WOPI `access_token` values.                                                       |
| `COLLABORA_DISCOVERY_URL`   | No                | Discovery endpoint override. Defaults to `${COLLABORA_URL}/hosting/discovery`.                                   |
| `COLLABORA_LANG`            | No (default `en`) | Language code for the Collabora UI.                                                                              |
| `COLLABORA_FILE_EXTENSIONS` | No                | Comma-separated list of office extensions to enable (otherwise nextExplorer uses defaults or discovery).         |

## Collabora container example (TLS termination at reverse proxy)

Collabora’s `domain` setting is a **regex** that must match your nextExplorer host.

```yaml
services:
  collabora:
    image: collabora/code:latest
    restart: unless-stopped
    cap_add: [MKNOD]
    ports:
      - '9980:9980'
    environment:
      - domain=files\\.example\\.com
      - server_name=collabora.example.com
      - username=admin
      - password=change-me
      - extra_params=--o:ssl.enable=false --o:ssl.termination=true
```

## Reverse proxy (Collabora)

If you see:

> “Failed to establish socket connection or socket connection closed unexpectedly…”

your proxy is almost always missing Collabora’s WebSocket forwarding for:

- `^/cool/(.*)/ws$` (main editing websocket)
- `/cool/adminws` (admin console websocket)

If you use **Nginx Proxy Manager**, turn on **Websockets Support** for the `collabora.example.com` proxy host. For raw Nginx examples, see Collabora’s proxy guide:

- `https://sdk.collaboraonline.com/docs/installation/Proxy_settings.html`

## How it works (high level)

1. The UI calls `POST /api/collabora/config` to obtain a Collabora `urlSrc` (iframe URL) and a signed `access_token`.
2. The browser loads the Collabora iframe.
3. Collabora calls nextExplorer’s WOPI endpoints (e.g. `GET /api/collabora/wopi/files/:fileId`) using the `access_token` to read/write and manage locks.

## Troubleshooting

- **Socket connection closed / websocket 400**: enable WebSocket support on the reverse proxy in front of Collabora and ensure `/cool/(.*)/ws` is proxied with `Upgrade`/`Connection` headers and long read timeouts.
- **Collabora says the WOPI host is not allowed**: your Collabora `domain` regex doesn’t match `PUBLIC_URL`’s host.
- **`Invalid access_token` in nextExplorer logs**: `COLLABORA_SECRET` mismatch, multiple backend instances using different secrets, or the request URL/token is being modified/truncated by a proxy.
