const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const request = require('supertest');

// Use temp dirs for DB and cache
const tmpRoot = fs.mkdtempSync(path.join(process.cwd(), 'tmp-test-auth-'));
process.env.CONFIG_DIR = path.join(tmpRoot, 'config');
process.env.CACHE_DIR = path.join(tmpRoot, 'cache');
process.env.SESSION_SECRET = 'test-secret';

// Build a tiny app with session and our auth routes.
// Optionally control AUTH_ENABLED via options.
const buildApp = ({ authEnabled } = {}) => {
  if (authEnabled === true) {
    process.env.AUTH_ENABLED = 'true';
  } else if (authEnabled === false) {
    process.env.AUTH_ENABLED = 'false';
  } else {
    delete process.env.AUTH_ENABLED;
  }

  // Clear config and dependent modules so they pick up updated env
  delete require.cache[require.resolve('../src/config/env')];
  delete require.cache[require.resolve('../src/config/index')];
  delete require.cache[require.resolve('../src/services/db')];
  delete require.cache[require.resolve('../src/services/users')];
  delete require.cache[require.resolve('../src/routes/auth')];

  const authRoutes = require('../src/routes/auth');

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
  return app;
};

test('auth routes: setup -> login -> me -> password -> logout', async () => {
  const app = buildApp({ authEnabled: true });

  // status before setup
  const s1 = await request(app).get('/api/auth/status').expect(200);
  assert.equal(s1.body.requiresSetup, true);
  assert.equal(s1.body.authEnabled, true);

  // setup admin
  const setup = await request(app)
    .post('/api/auth/setup')
    .send({
      email: 'admin@example.com',
      username: 'admin',
      password: 'secret123',
    })
    .expect(201);
  assert.ok(setup.body.user && setup.body.user.roles.includes('admin'));

  // login
  const agent = request.agent(app);
  await agent
    .post('/api/auth/login')
    .send({ email: 'admin@example.com', password: 'secret123' })
    .expect(200);

  // me
  const me = await agent.get('/api/auth/me').expect(200);
  assert.equal(me.body.user.username, 'admin');

  // change password
  await agent
    .post('/api/auth/password')
    .send({ currentPassword: 'secret123', newPassword: 'newpass456' })
    .expect(204);

  // logout
  await agent.post('/api/auth/logout').expect(204);
});

test('auth status reflects disabled auth via AUTH_ENABLED', async () => {
  const app = buildApp({ authEnabled: false });

  const status = await request(app).get('/api/auth/status').expect(200);
  assert.equal(status.body.authEnabled, false);
  assert.equal(status.body.authMode, 'both');
});
