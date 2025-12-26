const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const request = require('supertest');
const { setupTestEnv, clearModuleCache } = require('../helpers/env-test-utils');

let envContext;

test.before(async () => {
  envContext = await setupTestEnv({
    tag: 'auth-routes-test-',
    modules: ['src/services/db', 'src/services/users', 'src/routes/auth'],
  });
});

test.after(async () => {
  await envContext.cleanup();
});

const buildApp = ({ authEnabled } = {}) => {
  if (!envContext) {
    throw new Error('Test environment not initialized');
  }

  if (authEnabled === true) {
    process.env.AUTH_ENABLED = 'true';
  } else if (authEnabled === false) {
    process.env.AUTH_ENABLED = 'false';
  } else {
    delete process.env.AUTH_ENABLED;
  }

  clearModuleCache('src/config/env');
  clearModuleCache('src/config/index');
  clearModuleCache('src/services/db');
  clearModuleCache('src/services/users');

  const authRoutes = envContext.requireFresh('src/routes/auth');
  const app = express();
  app.use(bodyParser.json());
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
    }),
  );

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
