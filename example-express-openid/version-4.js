// ============================================================================
// FILE 1: config/oidc-config.js
// Configuration file for OpenID Connect providers
// ============================================================================

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../oidc-providers.json');

// Default configuration structure
const defaultConfig = {
  enabled: false,
  providers: []
};

// Example provider configuration
const exampleProvider = {
  name: "authentik",
  displayName: "Authentik",
  enabled: true,
  issuer: "https://authentik.example.com/application/o/myapp/",
  authorizationURL: "https://authentik.example.com/application/o/authorize/",
  tokenURL: "https://authentik.example.com/application/o/token/",
  userInfoURL: "https://authentik.example.com/application/o/userinfo/",
  clientID: "your-client-id",
  clientSecret: "your-client-secret",
  scope: ["openid", "profile", "email"],
  callbackURL: "/auth/oidc/callback"
};

class OIDCConfig {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading OIDC config:', error);
    }
    return defaultConfig;
  }

  saveConfig() {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving OIDC config:', error);
      return false;
    }
  }

  isEnabled() {
    return this.config.enabled && this.config.providers.length > 0;
  }

  getProviders() {
    return this.config.providers.filter(p => p.enabled);
  }

  getProvider(name) {
    return this.config.providers.find(p => p.name === name);
  }

  addProvider(provider) {
    this.config.providers.push(provider);
    return this.saveConfig();
  }

  updateProvider(name, updates) {
    const index = this.config.providers.findIndex(p => p.name === name);
    if (index !== -1) {
      this.config.providers[index] = { ...this.config.providers[index], ...updates };
      return this.saveConfig();
    }
    return false;
  }

  removeProvider(name) {
    this.config.providers = this.config.providers.filter(p => p.name !== name);
    return this.saveConfig();
  }

  setEnabled(enabled) {
    this.config.enabled = enabled;
    return this.saveConfig();
  }
}

module.exports = new OIDCConfig();

// ============================================================================
// FILE 2: config/passport-config.js
// Passport configuration with local and OIDC strategies
// ============================================================================

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const OpenIDConnectStrategy = require('passport-openidconnect').Strategy;
const oidcConfig = require('./oidc-config');
const userService = require('../services/user-service');

// Serialize user to session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await userService.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// ============================================================================
// Local Strategy (existing username/password authentication)
// ============================================================================
passport.use('local', new LocalStrategy(
  {
    usernameField: 'username',
    passwordField: 'password'
  },
  async (username, password, done) => {
    try {
      const user = await userService.authenticateLocal(username, password);
      if (!user) {
        return done(null, false, { message: 'Invalid username or password' });
      }
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

// ============================================================================
// Dynamic OIDC Strategy Configuration
// ============================================================================
function configureOIDCStrategies(app) {
  const providers = oidcConfig.getProviders();
  
  providers.forEach(provider => {
    const strategyName = `oidc-${provider.name}`;
    
    const strategyConfig = {
      issuer: provider.issuer,
      authorizationURL: provider.authorizationURL,
      tokenURL: provider.tokenURL,
      userInfoURL: provider.userInfoURL,
      clientID: provider.clientID,
      clientSecret: provider.clientSecret,
      callbackURL: `${process.env.BASE_URL || 'http://localhost:3000'}${provider.callbackURL}`,
      scope: provider.scope || ['openid', 'profile', 'email'],
      passReqToCallback: true
    };

    passport.use(strategyName, new OpenIDConnectStrategy(
      strategyConfig,
      async (req, issuer, profile, done) => {
        try {
          // Find or create user based on OIDC profile
          const user = await userService.findOrCreateOIDCUser({
            provider: provider.name,
            providerId: profile.id,
            issuer: issuer,
            email: profile.emails?.[0]?.value || profile.email,
            username: profile.username || profile.preferred_username || profile.email,
            displayName: profile.displayName || profile.name,
            profile: profile
          });

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    ));

    console.log(`✓ Configured OIDC strategy: ${strategyName} (${provider.displayName})`);
  });
}

module.exports = {
  configureOIDCStrategies
};

// ============================================================================
// FILE 3: services/user-service.js
// User management service
// ============================================================================

const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const USERS_FILE = path.join(__dirname, '../data/users.json');

class UserService {
  constructor() {
    this.users = [];
    this.loadUsers();
  }

  async loadUsers() {
    try {
      const data = await fs.readFile(USERS_FILE, 'utf8');
      this.users = JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.users = [];
        await this.saveUsers();
      } else {
        console.error('Error loading users:', error);
      }
    }
  }

  async saveUsers() {
    try {
      await fs.writeFile(USERS_FILE, JSON.stringify(this.users, null, 2));
    } catch (error) {
      console.error('Error saving users:', error);
    }
  }

  async findById(id) {
    return this.users.find(u => u.id === id);
  }

  async findByUsername(username) {
    return this.users.find(u => u.username === username);
  }

  async findByEmail(email) {
    return this.users.find(u => u.email === email);
  }

  async findByOIDCIdentity(provider, providerId) {
    return this.users.find(u => 
      u.oidcIdentities?.some(i => i.provider === provider && i.providerId === providerId)
    );
  }

  async authenticateLocal(username, password) {
    const user = await this.findByUsername(username);
    if (!user || user.authType !== 'local') {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return null;
    }

    return user;
  }

  async createLocalUser({ username, password, email, displayName }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = {
      id: crypto.randomUUID(),
      username,
      email,
      displayName: displayName || username,
      password: hashedPassword,
      authType: 'local',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };

    this.users.push(user);
    await this.saveUsers();

    return user;
  }

  async findOrCreateOIDCUser({ provider, providerId, issuer, email, username, displayName, profile }) {
    // Try to find existing user by OIDC identity
    let user = await this.findByOIDCIdentity(provider, providerId);

    if (user) {
      // Update last login
      user.lastLogin = new Date().toISOString();
      await this.saveUsers();
      return user;
    }

    // Try to find by email to link accounts
    user = await this.findByEmail(email);

    if (user) {
      // Link OIDC identity to existing user
      if (!user.oidcIdentities) {
        user.oidcIdentities = [];
      }
      user.oidcIdentities.push({
        provider,
        providerId,
        issuer,
        linkedAt: new Date().toISOString()
      });
      user.lastLogin = new Date().toISOString();
      await this.saveUsers();
      return user;
    }

    // Create new user
    const newUser = {
      id: crypto.randomUUID(),
      username: username || `${provider}_${providerId}`,
      email,
      displayName: displayName || username || email,
      authType: 'oidc',
      oidcIdentities: [{
        provider,
        providerId,
        issuer,
        linkedAt: new Date().toISOString()
      }],
      profile: {
        raw: profile
      },
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };

    this.users.push(newUser);
    await this.saveUsers();

    return newUser;
  }
}

module.exports = new UserService();

// ============================================================================
// FILE 4: routes/auth-routes.js
// Authentication routes
// ============================================================================

const express = require('express');
const passport = require('passport');
const oidcConfig = require('../config/oidc-config');
const router = express.Router();

// ============================================================================
// Local Authentication Routes
// ============================================================================

// POST /auth/local/login
router.post('/local/login', 
  passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/login',
    failureFlash: true
  })
);

// POST /auth/local/register
router.post('/local/register', async (req, res, next) => {
  try {
    const { username, password, email, displayName } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const userService = require('../services/user-service');
    
    // Check if user exists
    const existingUser = await userService.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Create user
    const user = await userService.createLocalUser({
      username,
      password,
      email,
      displayName
    });

    // Log in the user
    req.login(user, (err) => {
      if (err) return next(err);
      res.json({ success: true, user: { id: user.id, username: user.username, email: user.email } });
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// OpenID Connect Authentication Routes
// ============================================================================

// GET /auth/oidc/:provider - Initiate OIDC login
router.get('/oidc/:provider', (req, res, next) => {
  const provider = req.params.provider;
  const providerConfig = oidcConfig.getProvider(provider);

  if (!providerConfig || !providerConfig.enabled) {
    return res.status(404).json({ error: 'Provider not found or not enabled' });
  }

  const strategyName = `oidc-${provider}`;
  passport.authenticate(strategyName)(req, res, next);
});

// GET /auth/oidc/callback - OIDC callback (shared for all providers)
router.get('/oidc/callback', (req, res, next) => {
  // Determine which provider based on state or session
  // For simplicity, we'll use a query parameter
  const provider = req.query.provider || req.session.oidcProvider;

  if (!provider) {
    return res.status(400).json({ error: 'Provider not specified' });
  }

  const strategyName = `oidc-${provider}`;
  
  passport.authenticate(strategyName, {
    successRedirect: '/dashboard',
    failureRedirect: '/login',
    failureFlash: true
  })(req, res, next);
});

// ============================================================================
// Logout Route
// ============================================================================

router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy((err) => {
      if (err) return next(err);
      res.json({ success: true, message: 'Logged out successfully' });
    });
  });
});

// ============================================================================
// Get Available OIDC Providers (for frontend)
// ============================================================================

router.get('/oidc/providers', (req, res) => {
  const providers = oidcConfig.getProviders().map(p => ({
    name: p.name,
    displayName: p.displayName,
    loginUrl: `/auth/oidc/${p.name}`
  }));

  res.json({
    enabled: oidcConfig.isEnabled(),
    providers
  });
});

module.exports = router;

// ============================================================================
// FILE 5: routes/admin-routes.js
// Admin routes for configuring OIDC providers
// ============================================================================

const express = require('express');
const oidcConfig = require('../config/oidc-config');
const { configureOIDCStrategies } = require('../config/passport-config');
const router = express.Router();

// Middleware to check if user is admin
function isAdmin(req, res, next) {
  if (!req.isAuthenticated() || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// GET /admin/oidc/providers - List all OIDC providers
router.get('/oidc/providers', isAdmin, (req, res) => {
  res.json({
    enabled: oidcConfig.config.enabled,
    providers: oidcConfig.config.providers
  });
});

// POST /admin/oidc/providers - Add new OIDC provider
router.post('/oidc/providers', isAdmin, (req, res) => {
  const provider = req.body;
  
  // Validate required fields
  const required = ['name', 'displayName', 'issuer', 'authorizationURL', 'tokenURL', 'userInfoURL', 'clientID', 'clientSecret'];
  for (const field of required) {
    if (!provider[field]) {
      return res.status(400).json({ error: `Missing required field: ${field}` });
    }
  }

  const success = oidcConfig.addProvider(provider);
  if (success) {
    // Reconfigure strategies
    configureOIDCStrategies(req.app);
    res.json({ success: true, message: 'Provider added successfully' });
  } else {
    res.status(500).json({ error: 'Failed to save provider' });
  }
});

// PUT /admin/oidc/providers/:name - Update OIDC provider
router.put('/oidc/providers/:name', isAdmin, (req, res) => {
  const success = oidcConfig.updateProvider(req.params.name, req.body);
  if (success) {
    // Reconfigure strategies
    configureOIDCStrategies(req.app);
    res.json({ success: true, message: 'Provider updated successfully' });
  } else {
    res.status(404).json({ error: 'Provider not found' });
  }
});

// DELETE /admin/oidc/providers/:name - Remove OIDC provider
router.delete('/oidc/providers/:name', isAdmin, (req, res) => {
  const success = oidcConfig.removeProvider(req.params.name);
  if (success) {
    res.json({ success: true, message: 'Provider removed successfully' });
  } else {
    res.status(404).json({ error: 'Provider not found' });
  }
});

// POST /admin/oidc/enable - Enable/disable OIDC authentication
router.post('/oidc/enable', isAdmin, (req, res) => {
  const { enabled } = req.body;
  const success = oidcConfig.setEnabled(enabled);
  if (success) {
    res.json({ success: true, enabled });
  } else {
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

module.exports = router;

// ============================================================================
// FILE 6: app.js - Main Express application setup
// ============================================================================

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const fs = require('fs');

// Initialize Express app
const app = express();

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Load Passport configuration
require('./config/passport-config');

// Configure OIDC strategies
const { configureOIDCStrategies } = require('./config/passport-config');
configureOIDCStrategies(app);

// Routes
const authRoutes = require('./routes/auth-routes');
const adminRoutes = require('./routes/admin-routes');

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);

// Example protected route
app.get('/dashboard', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }
  res.json({
    message: 'Welcome to dashboard',
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      displayName: req.user.displayName,
      authType: req.user.authType
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('OIDC authentication:', require('./config/oidc-config').isEnabled() ? 'ENABLED' : 'DISABLED');
});

module.exports = app;

// ============================================================================
// FILE 7: package.json - Dependencies
// ============================================================================

/*
{
  "name": "express-oidc-auth",
  "version": "1.0.0",
  "description": "Express app with local and OpenID Connect authentication",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "express-session": "^1.17.3",
    "passport": "^0.7.0",
    "passport-local": "^1.0.0",
    "passport-openidconnect": "^0.1.2",
    "bcryptjs": "^2.4.3"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
*/

// ============================================================================
// FILE 8: .env.example - Environment variables
// ============================================================================

/*
# Server Configuration
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000

# Session Secret (change this in production!)
SESSION_SECRET=your-super-secret-session-key-change-me

# For production, set to true to enforce HTTPS cookies
SECURE_COOKIES=false
*/

// ============================================================================
// FILE 9: oidc-providers.json.example - Example OIDC configuration
// ============================================================================

/*
{
  "enabled": true,
  "providers": [
    {
      "name": "keycloak",
      "displayName": "Keycloak",
      "enabled": true,
      "issuer": "https://keycloak.example.com/realms/myrealm",
      "authorizationURL": "https://keycloak.example.com/realms/myrealm/protocol/openid-connect/auth",
      "tokenURL": "https://keycloak.example.com/realms/myrealm/protocol/openid-connect/token",
      "userInfoURL": "https://keycloak.example.com/realms/myrealm/protocol/openid-connect/userinfo",
      "clientID": "my-app-client",
      "clientSecret": "your-client-secret",
      "scope": ["openid", "profile", "email"],
      "callbackURL": "/auth/oidc/callback"
    },
    {
      "name": "authentik",
      "displayName": "Authentik",
      "enabled": true,
      "issuer": "https://authentik.example.com/application/o/myapp/",
      "authorizationURL": "https://authentik.example.com/application/o/authorize/",
      "tokenURL": "https://authentik.example.com/application/o/token/",
      "userInfoURL": "https://authentik.example.com/application/o/userinfo/",
      "clientID": "your-client-id",
      "clientSecret": "your-client-secret",
      "scope": ["openid", "profile", "email"],
      "callbackURL": "/auth/oidc/callback"
    },
    {
      "name": "google",
      "displayName": "Google",
      "enabled": false,
      "issuer": "https://accounts.google.com",
      "authorizationURL": "https://accounts.google.com/o/oauth2/v2/auth",
      "tokenURL": "https://oauth2.googleapis.com/token",
      "userInfoURL": "https://openidconnect.googleapis.com/v1/userinfo",
      "clientID": "your-google-client-id.apps.googleusercontent.com",
      "clientSecret": "your-google-client-secret",
      "scope": ["openid", "profile", "email"],
      "callbackURL": "/auth/oidc/callback"
    }
  ]
}
*/

// ============================================================================
// FILE 10: README.md - Setup instructions
// ============================================================================

/*
# Express OpenID Connect Authentication

This implementation provides both local username/password authentication and OpenID Connect (OIDC) 
single sign-on support for self-hosted applications.

## Features

- ✅ Local username/password authentication
- ✅ OpenID Connect authentication (Keycloak, Authentik, Okta, Google, etc.)
- ✅ Multiple OIDC provider support
- ✅ Dynamic provider configuration
- ✅ User account linking (OIDC + local)
- ✅ Session management
- ✅ JSON file-based user storage

## Installation

```bash
npm install
```

## Configuration

### 1. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your settings.

### 2. OIDC Providers Configuration

Create `oidc-providers.json` from the example:

```bash
cp oidc-providers.json.example oidc-providers.json
```

Edit the file to add your identity provider details.

### Getting OIDC Configuration Details

#### For Keycloak:

1. Go to your Keycloak admin console
2. Select your realm
3. Go to Clients → Create Client
4. Set Client ID and Client Protocol to "openid-connect"
5. Enable "Client authentication"
6. Add valid redirect URI: `http://localhost:3000/auth/oidc/callback`
7. Your configuration:
   - issuer: `https://your-keycloak.com/realms/{realm-name}`
   - authorizationURL: `https://your-keycloak.com/realms/{realm-name}/protocol/openid-connect/auth`
   - tokenURL: `https://your-keycloak.com/realms/{realm-name}/protocol/openid-connect/token`
   - userInfoURL: `https://your-keycloak.com/realms/{realm-name}/protocol/openid-connect/userinfo`

#### For Authentik:

1. Go to Authentik admin interface
2. Create a new Provider (OAuth2/OpenID)
3. Create a new Application
4. Set Redirect URIs: `http://localhost:3000/auth/oidc/callback`
5. Your configuration:
   - issuer: `https://your-authentik.com/application/o/{application-slug}/`
   - authorizationURL: `https://your-authentik.com/application/o/authorize/`
   - tokenURL: `https://your-authentik.com/application/o/token/`
   - userInfoURL: `https://your-authentik.com/application/o/userinfo/`

#### For Okta:

1. Go to Okta Developer Console
2. Applications → Create App Integration
3. Select "OIDC - OpenID Connect" and "Web Application"
4. Add Sign-in redirect URI: `http://localhost:3000/auth/oidc/callback`
5. Your configuration:
   - issuer: `https://your-domain.okta.com`
   - authorizationURL: `https://your-domain.okta.com/oauth2/default/v1/authorize`
   - tokenURL: `https://your-domain.okta.com/oauth2/default/v1/token`
   - userInfoURL: `https://your-domain.okta.com/oauth2/default/v1/userinfo`

## Usage

### Start the Server

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

### API Endpoints

#### Authentication

**Local Login:**
```bash
POST /auth/local/login
Content-Type: application/json

{
  "username": "user",
  "password": "password"
}
```

**Local Registration:**
```bash
POST /auth/local/register
Content-Type: application/json

{
  "username": "newuser",
  "password": "password",
  "email": "user@example.com",
  "displayName": "New User"
}
```

**OIDC Login:**
```bash
GET /auth/oidc/{provider}
```
Example: `GET /auth/oidc/keycloak` or `GET /auth/oidc/authentik`

**Logout:**
```bash
POST /auth/logout
```

**Get Available Providers:**
```bash
GET /auth/oidc/providers
```

#### Admin Endpoints (requires admin user)

**List Providers:**
```bash
GET /admin/oidc/providers
```

**Add Provider:**
```bash
POST /admin/oidc/providers
Content-Type: application/json

{
  "name": "myidp",
  "displayName": "My Identity Provider",
  "enabled": true,
  "issuer": "https://idp.example.com",
  "authorizationURL": "https://idp.example.com/authorize",
  "tokenURL": "https://idp.example.com/token",
  "userInfoURL": "https://idp.example.com/userinfo",
  "clientID": "client-id",
  "clientSecret": "client-secret",
  "scope": ["openid", "profile", "email"],
  "callbackURL": "/auth/oidc/callback"
}
```

**Update Provider:**
```bash
PUT /admin/oidc/providers/{name}
Content-Type: application/json

{
  "enabled": false
}
```

**Delete Provider:**
```bash
DELETE /admin/oidc/providers/{name}
```

## Frontend Integration

### Vue.js Example

In your Vue.js login component:

```vue
<template>
  <div class="login">
    <!-- Local Login Form -->
    <form @submit.prevent="loginLocal">
      <input v-model="username" placeholder="Username" />
      <input v-model="password" type="password" placeholder="Password" />
      <button type="submit">Login</button>
    </form>

    <!-- OIDC Login Options -->
    <div v-if="oidcEnabled" class="oidc-providers">
      <p>Or login with:</p>
      <button 
        v-for="provider in oidcProviders" 
        :key="provider.name"
        @click="loginOIDC(provider)"
      >
        {{ provider.displayName }}
      </button>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      username: '',
      password: '',
      oidcEnabled: false,
      oidcProviders: []
    };
  },
  async mounted() {
    // Fetch available OIDC providers
    const response = await fetch('/auth/oidc/providers');
    const data = await response.json();
    this.oidcEnabled = data.enabled;
    this.oidcProviders = data.providers;
  },
  methods: {
    async loginLocal() {
      const response = await fetch('/auth/local/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.username,
          password: this.password
        })
      });
      if (response.ok) {
        this.$router.push('/dashboard');
      }
    },
    loginOIDC(provider) {
      // Redirect to OIDC provider
      window.location.href = provider.loginUrl;
    }
  }
};
</script>
```

## Security Considerations

1. **Production Settings:**
   - Change `SESSION_SECRET` to a strong random value
   - Set `NODE_ENV=production`
   - Enable HTTPS and set `SECURE_COOKIES=true`
   - Use a proper session store (Redis, MongoDB) instead of in-memory

2. **OIDC Configuration:**
   - Keep `clientSecret` secure and never commit to version control
   - Use environment variables for sensitive data
   - Validate redirect URIs carefully
   - Enable HTTPS in production

3. **User Storage:**
   - The example uses JSON files for simplicity
   - For production, use a proper database (PostgreSQL, MongoDB, etc.)

## Troubleshooting

**"Provider not found" error:**
- Ensure the provider is configured in `oidc-providers.json`
- Check that `enabled: true` for the provider
- Verify the provider name matches the URL parameter

**Callback URL mismatch:**
- Ensure the callback URL in your IdP matches: `{BASE_URL}/auth/oidc/callback`
- Update `BASE_URL` in `.env` for your domain

**Authentication fails:**
- Check IdP logs for errors
- Verify client ID and secret are correct
- Ensure required scopes are configured
- Check that redirect URI is whitelisted in IdP

## License

MIT
*/

// ============================================================================
// FILE 11: Alternative: Simpler Single Provider Configuration
// config/simple-oidc-config.js
// ============================================================================

/**
 * If you only need ONE OIDC provider, you can simplify by using environment variables
 * instead of the JSON configuration file approach shown above.
 * 
 * Just set these in your .env file:
 * 
 * OIDC_ENABLED=true
 * OIDC_PROVIDER_NAME=keycloak
 * OIDC_DISPLAY_NAME=Keycloak
 * OIDC_ISSUER=https://keycloak.example.com/realms/myrealm
 * OIDC_AUTHORIZATION_URL=https://keycloak.example.com/realms/myrealm/protocol/openid-connect/auth
 * OIDC_TOKEN_URL=https://keycloak.example.com/realms/myrealm/protocol/openid-connect/token
 * OIDC_USERINFO_URL=https://keycloak.example.com/realms/myrealm/protocol/openid-connect/userinfo
 * OIDC_CLIENT_ID=my-app-client
 * OIDC_CLIENT_SECRET=your-client-secret
 * OIDC_CALLBACK_URL=/auth/oidc/callback
 * OIDC_SCOPE=openid profile email
 * 
 * Then use this simpler passport configuration:
 */

const passport = require('passport');
const OpenIDConnectStrategy = require('passport-openidconnect').Strategy;

function configureSimpleOIDC() {
  if (process.env.OIDC_ENABLED !== 'true') {
    return;
  }

  const config = {
    issuer: process.env.OIDC_ISSUER,
    authorizationURL: process.env.OIDC_AUTHORIZATION_URL,
    tokenURL: process.env.OIDC_TOKEN_URL,
    userInfoURL: process.env.OIDC_USERINFO_URL,
    clientID: process.env.OIDC_CLIENT_ID,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL}${process.env.OIDC_CALLBACK_URL}`,
    scope: process.env.OIDC_SCOPE?.split(' ') || ['openid', 'profile', 'email'],
    passReqToCallback: true
  };

  passport.use('oidc', new OpenIDConnectStrategy(
    config,
    async (req, issuer, profile, done) => {
      try {
        const userService = require('../services/user-service');
        const user = await userService.findOrCreateOIDCUser({
          provider: process.env.OIDC_PROVIDER_NAME || 'oidc',
          providerId: profile.id,
          issuer: issuer,
          email: profile.emails?.[0]?.value || profile.email,
          username: profile.username || profile.preferred_username || profile.email,
          displayName: profile.displayName || profile.name,
          profile: profile
        });
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  ));

  console.log(`✓ OIDC authentication configured: ${process.env.OIDC_DISPLAY_NAME}`);
}

// Simplified routes for single provider
const express = require('express');
const router = express.Router();

router.get('/oidc/login', passport.authenticate('oidc'));

router.get('/oidc/callback', 
  passport.authenticate('oidc', {
    successRedirect: '/dashboard',
    failureRedirect: '/login'
  })
);

module.exports = { configureSimpleOIDC, router };

// ============================================================================
// FILE 12: Vue.js Complete Login Component Example
// frontend/src/components/LoginPage.vue
// ============================================================================

/*
<template>
  <div class="login-page">
    <div class="login-container">
      <h1>Welcome</h1>

      <!-- Local Login Form -->
      <div class="login-form" v-if="!showRegister">
        <h2>Sign In</h2>
        <form @submit.prevent="handleLocalLogin">
          <div class="form-group">
            <label>Username</label>
            <input 
              v-model="loginForm.username" 
              type="text" 
              required 
              placeholder="Enter username"
            />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input 
              v-model="loginForm.password" 
              type="password" 
              required 
              placeholder="Enter password"
            />
          </div>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            {{ loading ? 'Signing in...' : 'Sign In' }}
          </button>
        </form>

        <p class="register-link">
          Don't have an account? 
          <a href="#" @click.prevent="showRegister = true">Register here</a>
        </p>
      </div>

      <!-- Registration Form -->
      <div class="register-form" v-else>
        <h2>Register</h2>
        <form @submit.prevent="handleRegister">
          <div class="form-group">
            <label>Username</label>
            <input 
              v-model="registerForm.username" 
              type="text" 
              required 
              placeholder="Choose username"
            />
          </div>
          <div class="form-group">
            <label>Email</label>
            <input 
              v-model="registerForm.email" 
              type="email" 
              required 
              placeholder="Enter email"
            />
          </div>
          <div class="form-group">
            <label>Display Name</label>
            <input 
              v-model="registerForm.displayName" 
              type="text" 
              placeholder="Your name"
            />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input 
              v-model="registerForm.password" 
              type="password" 
              required 
              placeholder="Create password"
            />
          </div>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            {{ loading ? 'Creating account...' : 'Create Account' }}
          </button>
        </form>

        <p class="login-link">
          Already have an account? 
          <a href="#" @click.prevent="showRegister = false">Sign in here</a>
        </p>
      </div>

      <!-- OIDC Login Options -->
      <div v-if="oidcEnabled && oidcProviders.length > 0" class="oidc-section">
        <div class="divider">
          <span>OR</span>
        </div>
        <h3>Sign in with</h3>
        <div class="oidc-providers">
          <button 
            v-for="provider in oidcProviders" 
            :key="provider.name"
            @click="handleOIDCLogin(provider)"
            class="btn btn-oidc"
            :class="`btn-${provider.name}`"
          >
            <span class="provider-icon">{{ getProviderIcon(provider.name) }}</span>
            {{ provider.displayName }}
          </button>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LoginPage',
  data() {
    return {
      showRegister: false,
      loading: false,
      error: null,
      oidcEnabled: false,
      oidcProviders: [],
      loginForm: {
        username: '',
        password: ''
      },
      registerForm: {
        username: '',
        email: '',
        displayName: '',
        password: ''
      }
    };
  },
  async mounted() {
    await this.fetchOIDCProviders();
  },
  methods: {
    async fetchOIDCProviders() {
      try {
        const response = await fetch('/auth/oidc/providers');
        const data = await response.json();
        this.oidcEnabled = data.enabled;
        this.oidcProviders = data.providers;
      } catch (err) {
        console.error('Failed to fetch OIDC providers:', err);
      }
    },
    
    async handleLocalLogin() {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await fetch('/auth/local/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(this.loginForm),
          credentials: 'include'
        });

        if (response.redirected) {
          window.location.href = response.url;
          return;
        }

        if (response.ok) {
          this.$router.push('/dashboard');
        } else {
          const data = await response.json();
          this.error = data.message || 'Login failed. Please check your credentials.';
        }
      } catch (err) {
        this.error = 'An error occurred during login. Please try again.';
        console.error('Login error:', err);
      } finally {
        this.loading = false;
      }
    },

    async handleRegister() {
      this.loading = true;
      this.error = null;

      try {
        const response = await fetch('/auth/local/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(this.registerForm),
          credentials: 'include'
        });

        const data = await response.json();

        if (response.ok && data.success) {
          this.$router.push('/dashboard');
        } else {
          this.error = data.error || 'Registration failed. Please try again.';
        }
      } catch (err) {
        this.error = 'An error occurred during registration. Please try again.';
        console.error('Registration error:', err);
      } finally {
        this.loading = false;
      }
    },

    handleOIDCLogin(provider) {
      // Redirect to OIDC provider login
      window.location.href = provider.loginUrl;
    },

    getProviderIcon(name) {
      const icons = {
        google: '🔍',
        keycloak: '🔐',
        authentik: '🛡️',
        okta: '🔑',
        github: '🐙',
        gitlab: '🦊',
        azure: '☁️'
      };
      return icons[name] || '🔑';
    }
  }
};
</script>

<style scoped>
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  padding: 40px;
  max-width: 450px;
  width: 100%;
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
}

h2 {
  color: #555;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 8px;
  color: #555;
  font-weight: 500;
}

input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.3s;
  box-sizing: border-box;
}

input:focus {
  outline: none;
  border-color: #667eea;
}

.btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5568d3;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.register-link,
.login-link {
  text-align: center;
  margin-top: 20px;
  color: #666;
}

.register-link a,
.login-link a {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
}

.oidc-section {
  margin-top: 30px;
}

.divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 30px 0 20px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #ddd;
}

.divider span {
  padding: 0 15px;
  color: #999;
  font-size: 14px;
}

h3 {
  font-size: 16px;
  color: #666;
  margin-bottom: 15px;
}

.oidc-providers {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.btn-oidc {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: white;
  color: #333;
  border: 2px solid #ddd;
}

.btn-oidc:hover {
  border-color: #667eea;
  background: #f8f9ff;
  transform: translateY(-1px);
}

.provider-icon {
  font-size: 20px;
}

.btn-google:hover {
  border-color: #4285f4;
  background: #f1f8ff;
}

.btn-keycloak:hover,
.btn-authentik:hover {
  border-color: #667eea;
  background: #f8f9ff;
}

.error-message {
  margin-top: 20px;
  padding: 12px;
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 6px;
  color: #c33;
  text-align: center;
}
</style>
*/

// ============================================================================
// FILE 13: middleware/auth-middleware.js
// Authentication middleware for protecting routes
// ============================================================================

/**
 * Middleware to ensure user is authenticated
 */
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  
  // For API requests, return JSON
  if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // For browser requests, redirect to login
  res.redirect('/login');
}

/**
 * Middleware to ensure user is admin
 */
function ensureAdmin(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}

/**
 * Middleware to check if user has specific role
 */
function ensureRole(role) {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!req.user.roles || !req.user.roles.includes(role)) {
      return res.status(403).json({ error: `Role '${role}' required` });
    }
    
    next();
  };
}

/**
 * Middleware to attach user info to response locals for views
 */
function attachUser(req, res, next) {
  res.locals.user = req.user || null;
  res.locals.isAuthenticated = req.isAuthenticated();
  next();
}

/**
 * Middleware to ensure user is NOT authenticated (for login/register pages)
 */
function ensureGuest(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = {
  ensureAuthenticated,
  ensureAdmin,
  ensureRole,
  attachUser,
  ensureGuest
};

// ============================================================================
// FILE 14: utils/oidc-discovery.js
// OIDC Discovery utility for auto-configuration
// ============================================================================

const https = require('https');

/**
 * Discover OIDC configuration from issuer URL
 * This follows the OpenID Connect Discovery specification
 * @param {string} issuer - The issuer URL (e.g., https://accounts.google.com)
 * @returns {Promise<Object>} Discovery document
 */
async function discoverOIDCConfiguration(issuer) {
  // Remove trailing slash
  const cleanIssuer = issuer.replace(/\/$/, '');
  
  // Standard discovery endpoint
  const discoveryUrl = `${cleanIssuer}/.well-known/openid-configuration`;
  
  return new Promise((resolve, reject) => {
    https.get(discoveryUrl, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const config = JSON.parse(data);
            resolve(config);
          } catch (err) {
            reject(new Error('Invalid JSON response from discovery endpoint'));
          }
        } else {
          reject(new Error(`Discovery failed with status ${res.statusCode}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Create provider configuration from discovery
 * @param {string} name - Provider name
 * @param {string} displayName - Display name
 * @param {string} issuer - Issuer URL
 * @param {string} clientID - Client ID
 * @param {string} clientSecret - Client Secret
 * @param {Array<string>} scope - Scopes
 * @returns {Promise<Object>} Provider configuration
 */
async function createProviderFromDiscovery(name, displayName, issuer, clientID, clientSecret, scope) {
  try {
    const discovery = await discoverOIDCConfiguration(issuer);
    
    return {
      name,
      displayName,
      enabled: true,
      issuer: discovery.issuer,
      authorizationURL: discovery.authorization_endpoint,
      tokenURL: discovery.token_endpoint,
      userInfoURL: discovery.userinfo_endpoint,
      clientID,
      clientSecret,
      scope: scope || ['openid', 'profile', 'email'],
      callbackURL: '/auth/oidc/callback'
    };
  } catch (error) {
    throw new Error(`Failed to discover OIDC configuration: ${error.message}`);
  }
}

module.exports = {
  discoverOIDCConfiguration,
  createProviderFromDiscovery
};

// Example usage in admin routes:
// const { createProviderFromDiscovery } = require('../utils/oidc-discovery');
// 
// router.post('/admin/oidc/providers/discover', async (req, res) => {
//   const { name, displayName, issuer, clientID, clientSecret, scope } = req.body;
//   try {
//     const provider = await createProviderFromDiscovery(
//       name, displayName, issuer, clientID, clientSecret, scope
//     );
//     res.json({ success: true, provider });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// });

// ============================================================================
// FILE 15: utils/session-store.js
// Production-ready session store examples
// ============================================================================

/**
 * For production, you should use a persistent session store
 * Here are examples for different stores:
 */

// ---------- Redis Session Store (Recommended for production) ----------
/*
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

// Create Redis client
const redisClient = createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD
});

redisClient.connect().catch(console.error);

// Create session middleware with Redis store
const sessionMiddleware = session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
});

module.exports = sessionMiddleware;
*/

// ---------- MongoDB Session Store ----------
/*
const session = require('express-session');
const MongoStore = require('connect-mongo');

const sessionMiddleware = session({
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp',
    ttl: 24 * 60 * 60 // 24 hours
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
});

module.exports = sessionMiddleware;
*/

// ---------- PostgreSQL Session Store ----------
/*
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD
});

const sessionMiddleware = session({
  store: new pgSession({
    pool,
    tableName: 'user_sessions'
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
});

module.exports = sessionMiddleware;
*/

// ============================================================================
// FILE 16: config/provider-templates.js
// Pre-configured templates for popular OIDC providers
// ============================================================================

/**
 * Templates for popular OIDC providers
 * Use these to quickly configure well-known providers
 */

const providerTemplates = {
  keycloak: (realm, domain, clientID, clientSecret) => ({
    name: 'keycloak',
    displayName: 'Keycloak',
    enabled: true,
    issuer: `${domain}/realms/${realm}`,
    authorizationURL: `${domain}/realms/${realm}/protocol/openid-connect/auth`,
    tokenURL: `${domain}/realms/${realm}/protocol/openid-connect/token`,
    userInfoURL: `${domain}/realms/${realm}/protocol/openid-connect/userinfo`,
    clientID,
    clientSecret,
    scope: ['openid', 'profile', 'email'],
    callbackURL: '/auth/oidc/callback'
  }),

  authentik: (domain, appSlug, clientID, clientSecret) => ({
    name: 'authentik',
    displayName: 'Authentik',
    enabled: true,
    issuer: `${domain}/application/o/${appSlug}/`,
    authorizationURL: `${domain}/application/o/authorize/`,
    tokenURL: `${domain}/application/o/token/`,
    userInfoURL: `${domain}/application/o/userinfo/`,
    clientID,
    clientSecret,
    scope: ['openid', 'profile', 'email'],
    callbackURL: '/auth/oidc/callback'
  }),

  google: (clientID, clientSecret) => ({
    name: 'google',
    displayName: 'Google',
    enabled: true,
    issuer: 'https://accounts.google.com',
    authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenURL: 'https://oauth2.googleapis.com/token',
    userInfoURL: 'https://openidconnect.googleapis.com/v1/userinfo',
    clientID,
    clientSecret,
    scope: ['openid', 'profile', 'email'],
    callbackURL: '/auth/oidc/callback'
  }),

  okta: (domain, clientID, clientSecret, authServer = 'default') => ({
    name: 'okta',
    displayName: 'Okta',
    enabled: true,
    issuer: `${domain}/oauth2/${authServer}`,
    authorizationURL: `${domain}/oauth2/${authServer}/v1/authorize`,
    tokenURL: `${domain}/oauth2/${authServer}/v1/token`,
    userInfoURL: `${domain}/oauth2/${authServer}/v1/userinfo`,
    clientID,
    clientSecret,
    scope: ['openid', 'profile', 'email'],
    callbackURL: '/auth/oidc/callback'
  }),

  azure: (tenantId, clientID, clientSecret) => ({
    name: 'azure',
    displayName: 'Microsoft Azure AD',
    enabled: true,
    issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    authorizationURL: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    tokenURL: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    userInfoURL: 'https://graph.microsoft.com/oidc/userinfo',
    clientID,
    clientSecret,
    scope: ['openid', 'profile', 'email'],
    callbackURL: '/auth/oidc/callback'
  }),

  github: (clientID, clientSecret) => ({
    name: 'github',
    displayName: 'GitHub',
    enabled: true,
    // Note: GitHub doesn't fully support OIDC, consider using passport-github2 instead
    issuer: 'https://github.com',
    authorizationURL: 'https://github.com/login/oauth/authorize',
    tokenURL: 'https://github.com/login/oauth/access_token',
    userInfoURL: 'https://api.github.com/user',
    clientID,
    clientSecret,
    scope: ['read:user', 'user:email'],
    callbackURL: '/auth/oidc/callback'
  }),

  gitlab: (domain, clientID, clientSecret) => ({
    name: 'gitlab',
    displayName: 'GitLab',
    enabled: true,
    issuer: domain,
    authorizationURL: `${domain}/oauth/authorize`,
    tokenURL: `${domain}/oauth/token`,
    userInfoURL: `${domain}/oauth/userinfo`,
    clientID,
    clientSecret,
    scope: ['openid', 'profile', 'email'],
    callbackURL: '/auth/oidc/callback'
  })
};

/**
 * Get provider template
 * @param {string} providerType - Type of provider (keycloak, google, etc.)
 * @param {Object} params - Provider-specific parameters
 * @returns {Object} Provider configuration
 */
function getProviderTemplate(providerType, params) {
  const template = providerTemplates[providerType];
  if (!template) {
    throw new Error(`Unknown provider template: ${providerType}`);
  }
  return template(...Object.values(params));
}

module.exports = {
  providerTemplates,
  getProviderTemplate
};

// Example usage:
// const { getProviderTemplate } = require('./config/provider-templates');
// 
// const keycloakProvider = getProviderTemplate('keycloak', {
//   realm: 'myrealm',
//   domain: 'https://keycloak.example.com',
//   clientID: 'my-client',
//   clientSecret: 'secret'
// });

// ============================================================================
// FILE 17: tests/auth.test.js
// Basic tests for authentication (using Jest)
// ============================================================================

/*
const request = require('supertest');
const app = require('../app');

describe('Authentication Tests', () => {
  describe('Local Authentication', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/auth/local/register')
        .send({
          username: 'testuser',
          password: 'testpass123',
          email: 'test@example.com',
          displayName: 'Test User'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toHaveProperty('id');
    });

    it('should not register duplicate username', async () => {
      // First registration
      await request(app)
        .post('/auth/local/register')
        .send({
          username: 'duplicate',
          password: 'pass123',
          email: 'dup@example.com'
        });

      // Duplicate registration
      const response = await request(app)
        .post('/auth/local/register')
        .send({
          username: 'duplicate',
          password: 'pass456',
          email: 'dup2@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });

    it('should login with correct credentials', async () => {
      const agent = request.agent(app);

      // Register user
      await agent
        .post('/auth/local/register')
        .send({
          username: 'logintest',
          password: 'testpass123',
          email: 'login@example.com'
        });

      // Logout
      await agent.post('/auth/logout');

      // Login
      const response = await agent
        .post('/auth/local/login')
        .send({
          username: 'logintest',
          password: 'testpass123'
        });

      expect(response.status).toBe(302); // Redirect to dashboard
    });

    it('should reject incorrect password', async () => {
      const agent = request.agent(app);

      // Register user
      await agent
        .post('/auth/local/register')
        .send({
          username: 'wrongpass',
          password: 'correctpass',
          email: 'wrong@example.com'
        });

      // Logout
      await agent.post('/auth/logout');

      // Try to login with wrong password
      const response = await agent
        .post('/auth/local/login')
        .send({
          username: 'wrongpass',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(302); // Redirect back to login
    });
  });

  describe('OIDC Providers', () => {
    it('should list available OIDC providers', async () => {
      const response = await request(app)
        .get('/auth/oidc/providers');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('enabled');
      expect(response.body).toHaveProperty('providers');
      expect(Array.isArray(response.body.providers)).toBe(true);
    });

    it('should return 404 for non-existent provider', async () => {
      const response = await request(app)
        .get('/auth/oidc/nonexistent');

      expect(response.status).toBe(404);
    });
  });

  describe('Protected Routes', () => {
    it('should deny access to dashboard without auth', async () => {
      const response = await request(app)
        .get('/dashboard');

      expect(response.status).toBe(302); // Redirect to login
    });

    it('should allow access to dashboard with auth', async () => {
      const agent = request.agent(app);

      // Login
      await agent
        .post('/auth/local/register')
        .send({
          username: 'dashboarduser',
          password: 'pass123',
          email: 'dash@example.com'
        });

      // Access dashboard
      const response = await agent.get('/dashboard');

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('username', 'dashboarduser');
    });
  });
});

// To run tests, add to package.json:
// "scripts": {
//   "test": "jest --coverage",
//   "test:watch": "jest --watch"
// },
// "devDependencies": {
//   "jest": "^29.0.0",
//   "supertest": "^6.3.0"
// }
*/