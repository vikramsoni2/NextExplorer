const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const request = require('supertest');

const { setupTestEnv, clearModuleCache } = require('./helpers/env-test-utils');

const buildApp = (envContext) => {
  const authRoutes = envContext.requireFresh('src/routes/auth');
  const app = express();
  app.use(bodyParser.json());
  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  }));

  // Minimal stub for req.oidc so /status works without EOC
  app.use((req, _res, next) => {
    req.oidc = { isAuthenticated: () => false };
    next();
  });

  app.use('/api/auth', authRoutes);
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message });
  });
  return app;
};

const requireFreshBootstrap = (envContext) => {
  clearModuleCache('src/config/env');
  clearModuleCache('src/config/index');
  clearModuleCache('src/services/users');
  clearModuleCache('src/utils/bootstrap');
  return envContext.requireFresh('src/utils/bootstrap');
};

test('env admin bootstrap creates admin and skips setup', async () => {
  const envContext = await setupTestEnv({
    tag: 'admin-bootstrap-env-creates-',
    modules: ['src/services/db', 'src/services/users', 'src/utils/bootstrap', 'src/routes/auth'],
    env: {
      AUTH_ENABLED: 'true',
      AUTH_MODE: 'local',
      AUTH_ADMIN_EMAIL: 'admin@example.com',
      AUTH_ADMIN_PASSWORD: 'secret123',
    },
  });

  try {
    const { bootstrap } = requireFreshBootstrap(envContext);
    await bootstrap();

    const app = buildApp(envContext);
    const status = await request(app).get('/api/auth/status').expect(200);
    assert.equal(status.body.requiresSetup, false);

    await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'secret123' })
      .expect(200);
  } finally {
    await envContext.cleanup();
  }
});

test('env admin bootstrap overrides existing password', async () => {
  const envContext = await setupTestEnv({
    tag: 'admin-bootstrap-env-overrides-',
    modules: ['src/services/db', 'src/services/users', 'src/utils/bootstrap'],
    env: {
      AUTH_ENABLED: 'true',
      AUTH_MODE: 'local',
      AUTH_ADMIN_EMAIL: 'admin@example.com',
      AUTH_ADMIN_PASSWORD: 'secret123',
    },
  });

  try {
    // First boot: create admin with secret123
    {
      const { bootstrap } = requireFreshBootstrap(envContext);
      await bootstrap();
    }

    // Second boot: override password
    process.env.AUTH_ADMIN_PASSWORD = 'newpass456';
    {
      const { bootstrap } = requireFreshBootstrap(envContext);
      await bootstrap();
    }

    const users = envContext.requireFresh('src/services/users');
    const ok = await users.attemptLocalLogin({ email: 'admin@example.com', password: 'newpass456' });
    assert.ok(ok);
    const old = await users.attemptLocalLogin({ email: 'admin@example.com', password: 'secret123' });
    assert.equal(old, null);
  } finally {
    await envContext.cleanup();
  }
});

