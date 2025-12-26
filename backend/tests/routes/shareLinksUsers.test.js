const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const express = require('express');
const session = require('express-session');
const request = require('supertest');
const { setupTestEnv, clearModuleCache } = require('../helpers/env-test-utils');

let envContext;

test.before(async () => {
  envContext = await setupTestEnv({
    tag: 'share-links-users-test-',
    modules: [
      'src/services/db',
      'src/services/users',
      'src/middleware/authMiddleware',
      'src/middleware/errorHandler',
      'src/routes/auth',
      'src/routes/shares',
    ],
  });
});

test.after(async () => {
  await envContext.cleanup();
});

const buildApp = () => {
  if (!envContext) throw new Error('Test environment not initialized');

  process.env.AUTH_ENABLED = 'true';
  clearModuleCache('src/config/env');
  clearModuleCache('src/config/index');

  const authRoutes = envContext.requireFresh('src/routes/auth');
  const sharesRoutes = envContext.requireFresh('src/routes/shares');
  const authMiddleware = envContext.requireFresh(
    'src/middleware/authMiddleware',
  );
  const { errorHandler } = envContext.requireFresh(
    'src/middleware/errorHandler',
  );

  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
    }),
  );

  // Minimal stub for req.oidc so auth middleware doesn't treat requests as EOC-authenticated.
  app.use((req, _res, next) => {
    req.oidc = { isAuthenticated: () => false };
    next();
  });

  app.use(authMiddleware);

  app.use('/api/auth', authRoutes);
  app.use('/api/shares', sharesRoutes);
  app.use('/api/share', sharesRoutes);
  app.use(errorHandler);

  return app;
};

test('user-specific share links: /api/share/:token/access works when logged in', async () => {
  const usersService = envContext.requireFresh('src/services/users');
  const app = buildApp();

  // Setup the first account (admin/owner).
  await request(app)
    .post('/api/auth/setup')
    .send({
      email: 'owner@example.com',
      username: 'owner',
      password: 'secret123',
    })
    .expect(201);

  // Create a recipient user directly in DB.
  const recipient = await usersService.createLocalUser({
    email: 'recipient@example.com',
    username: 'recipient',
    displayName: 'Recipient',
    password: 'secret123',
    roles: ['user'],
  });

  // Create a folder to share under the volume root.
  const sharedFolder = path.join(envContext.volumeDir, 'docs');
  await fs.mkdir(sharedFolder, { recursive: true });
  await fs.writeFile(path.join(sharedFolder, 'hello.txt'), 'hello');

  // Owner logs in and creates a user-specific share to the recipient.
  const ownerAgent = request.agent(app);
  await ownerAgent
    .post('/api/auth/login')
    .send({ email: 'owner@example.com', password: 'secret123' })
    .expect(200);

  const shareCreate = await ownerAgent
    .post('/api/shares')
    .send({
      sourcePath: 'docs',
      accessMode: 'readonly',
      sharingType: 'users',
      userIds: [recipient.id],
    })
    .expect(201);

  const token = shareCreate.body?.shareToken;
  assert.ok(token);

  // Recipient logs in and can access via the share access endpoint.
  const recipientAgent = request.agent(app);
  await recipientAgent
    .post('/api/auth/login')
    .send({ email: 'recipient@example.com', password: 'secret123' })
    .expect(200);

  const access = await recipientAgent
    .get(`/api/share/${token}/access`)
    .expect(200);

  assert.equal(access.body?.share?.shareToken, token);
  assert.equal(access.body?.share?.sourcePath, `share/${token}`);
});
