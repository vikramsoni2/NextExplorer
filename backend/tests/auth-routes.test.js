import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import request from 'supertest';

// Use temp cache dir for DB
const tmp = fs.mkdtempSync(path.join(process.cwd(), 'tmp-test-auth-'));
process.env.CACHE_DIR = tmp;
process.env.SESSION_SECRET = 'test-secret';

const authRouter = (await import('../routes/auth.js')).default || (await import('../routes/auth.js'));
const authRoutes = authRouter?.default || authRouter;

// Build a tiny app with session and our auth routes
const buildApp = () => {
  const app = express();
  app.use(bodyParser.json());
  app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false }));
  // Minimal stub for req.oidc so /status works without EOC
  app.use((req, _res, next) => {
    req.oidc = { isAuthenticated: () => false };
    next();
  });
  app.use('/api/auth', authRoutes);
  return app;
};

test('auth routes: setup -> login -> me -> password -> logout', async () => {
  const app = buildApp();

  // status before setup
  const s1 = await request(app).get('/api/auth/status').expect(200);
  assert.equal(s1.body.requiresSetup, true);

  // setup admin
  const setup = await request(app).post('/api/auth/setup').send({ username: 'admin', password: 'secret123' }).expect(201);
  assert.ok(setup.body.user && setup.body.user.roles.includes('admin'));

  // login
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'admin', password: 'secret123' }).expect(200);

  // me
  const me = await agent.get('/api/auth/me').expect(200);
  assert.equal(me.body.user.username, 'admin');

  // change password
  await agent.post('/api/auth/password').send({ currentPassword: 'secret123', newPassword: 'newpass456' }).expect(204);

  // logout
  await agent.post('/api/auth/logout').expect(204);
});

