# Docker Configuration Files

This directory contains all Docker-related configuration files for nextExplorer.

## Files

### Production Docker Compose Files

- **`docker-compose.yml`** - Production docker-compose configuration (single container) - *customize this for your deployment*
- **`docker-compose.dev.yml`** - Development docker-compose configuration (separate backend/frontend services with hot-reload) - *customize this for your development setup*

### Ready-to-Use Configuration Files

Choose the file that matches your needs and use it directly with the `-f` flag:

- **`docker-compose.minimal.yml`** - **Minimum setup** - Basic configuration with local authentication
- **`docker-compose.oidc.yml`** - **OIDC/SSO setup** - Configured for single sign-on with identity providers (Keycloak, Authentik, Authelia, etc.)
- **`docker-compose.onlyoffice.yml`** - **OnlyOffice integration** - Includes OnlyOffice Document Server configuration
- **`docker-compose.collabora.yml`** - **Collabora integration** - Includes Collabora CODE (WOPI) configuration
- **`docker-compose.user-dirs.yml`** - **User directories** - Enables personal "My Files" directories for each user
- **`docker-compose.no-auth.yml`** - **No authentication** - Disables authentication entirely (use with caution!)

### Development Files

- **`docker-compose.dev.yml.example`** - Development example with all environment variables documented

### Supporting Files

- **`entrypoint.sh`** - Container entrypoint script for user mapping and initialization
- **`healthcheck.js`** - Health check script for container monitoring

## Quick Start

### Production Setup

1. **Choose the configuration file** that matches your needs (see descriptions below)

2. **Edit the file** and configure:
   - Environment variables (especially `PUBLIC_URL` and `SESSION_SECRET`)
   - Volume mounts to match your system paths
   - Integration settings (OIDC, OnlyOffice, Collabora) if applicable

3. **Run from the repository root**:
   ```bash
   # For minimal setup:
   docker-compose -f docker/docker-compose.minimal.yml up -d
   
   # For OIDC/SSO:
   docker-compose -f docker/docker-compose.oidc.yml up -d
   
   # For OnlyOffice:
   docker-compose -f docker/docker-compose.onlyoffice.yml up -d
   
   # For Collabora:
   docker-compose -f docker/docker-compose.collabora.yml up -d
   
   # For user directories:
   docker-compose -f docker/docker-compose.user-dirs.yml up -d
   
   # For no authentication:
   docker-compose -f docker/docker-compose.no-auth.yml up -d
   ```

**Tip:** You can also copy your chosen file to `docker-compose.yml` for convenience:
```bash
cp docker/docker-compose.minimal.yml docker/docker-compose.yml
docker-compose -f docker/docker-compose.yml up -d
```

### Development Setup

1. Edit `docker/docker-compose.dev.yml.example` (or copy to `docker-compose.dev.yml`)

2. Configure environment variables and volume mounts

3. Run from the repository root:
   ```bash
   docker-compose -f docker/docker-compose.dev.yml.example up --build
   ```

## Configuration File Descriptions

### Minimum Setup (`docker-compose.minimal.yml`)
Basic configuration with local username/password authentication. Perfect for getting started quickly or simple deployments.

**Use when:**
- You want a simple setup with local authentication
- You don't need SSO or document editing integrations
- You're setting up nextExplorer for the first time

### OIDC/SSO Setup (`docker-compose.oidc.yml`)
Configured for single sign-on with identity providers like Keycloak, Authentik, or Authelia.

**Use when:**
- You want to integrate with your existing identity provider
- You need centralized user management
- You want to use group-based admin assignment

**Required configuration:**
- `OIDC_ISSUER` - Your identity provider's issuer URL
- `OIDC_CLIENT_ID` - OIDC client ID
- `OIDC_CLIENT_SECRET` - OIDC client secret
- `OIDC_ADMIN_GROUPS` - Groups that should have admin access

### OnlyOffice Integration (`docker-compose.onlyoffice.yml`)
Includes OnlyOffice Document Server configuration for editing Office documents in the browser.

**Use when:**
- You have an OnlyOffice Document Server instance
- You want to edit Word, Excel, PowerPoint documents in the browser
- You prefer OnlyOffice over Collabora

**Required configuration:**
- `ONLYOFFICE_URL` - Your OnlyOffice Document Server URL
- `ONLYOFFICE_SECRET` - JWT secret (must match OnlyOffice server config)

### Collabora Integration (`docker-compose.collabora.yml`)
Includes Collabora CODE (WOPI) configuration for editing Office documents in the browser.

**Use when:**
- You have a Collabora CODE server instance
- You want to edit Office documents in the browser
- You prefer Collabora over OnlyOffice

**Required configuration:**
- `COLLABORA_URL` - Your Collabora CODE server URL
- `COLLABORA_SECRET` - JWT secret (must match Collabora server config)

### User Directories (`docker-compose.user-dirs.yml`)
Enables personal "My Files" directories for each authenticated user.

**Use when:**
- You want each user to have their own personal directory
- You need user-specific file storage
- You want to enable the "My Files" feature in the UI

**Required configuration:**
- `USER_DIR_ENABLED=true`
- `USER_ROOT` - Directory where user folders will be created
- Mount the `USER_ROOT` path as a volume

### No Authentication (`docker-compose.no-auth.yml`)
Disables authentication entirely. All APIs are public.

**⚠️ WARNING:** Only use this in trusted environments or behind a reverse proxy with authentication.

**Use when:**
- You're running on a trusted internal network
- You have network-level security (firewall, VPN)
- You're setting up for development/testing
- You want public read-only access (with access control rules)

**Security considerations:**
- Use Settings → Access Control to restrict access to specific paths
- Consider running behind a reverse proxy with authentication
- Not recommended for production without additional security layers

## Combining Features

You can combine features by editing one configuration file and adding settings from others. For example:

1. Start with `docker-compose.oidc.yml` for SSO
2. Add OnlyOffice or Collabora configuration from their respective files
3. Add `USER_DIR_ENABLED=true` if you want user directories

## Note

The `Dockerfile` remains in the repository root because it needs to reference files in the build context (backend/, frontend/). The docker-compose files are located here to keep the root directory clean.
