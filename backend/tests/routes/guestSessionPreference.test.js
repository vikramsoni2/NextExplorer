const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const { setupTestEnv, clearModuleCache } = require('../helpers/env-test-utils');

let envContext;

test.before(async () => {
  envContext = await setupTestEnv({
    tag: 'guest-session-preference-test-',
    modules: [
      'src/services/db',
      'src/services/users',
      'src/services/sharesService',
      'src/services/guestSessionService',
      'src/middleware/authMiddleware',
      'src/middleware/errorHandler',
      'src/routes/auth',
      'src/routes/shares',
      'src/routes/browse',
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
  const browseRoutes = envContext.requireFresh('src/routes/browse');
  const authMiddleware = envContext.requireFresh(
    'src/middleware/authMiddleware',
  );
  const { errorHandler } = envContext.requireFresh(
    'src/middleware/errorHandler',
  );

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
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
  app.use('/api', browseRoutes);
  app.use(errorHandler);

  return app;
};

test('authenticated user takes precedence over guest session when browsing volumes', async () => {
  const app = buildApp();

  // Create a folder in the test volume.
  const projectsDir = path.join(envContext.volumeDir, 'Projects');
  await fs.mkdir(projectsDir, { recursive: true });
  await fs.writeFile(path.join(projectsDir, 'hello.txt'), 'hello');

  // Setup and login as owner.
  const ownerAgent = request.agent(app);
  await ownerAgent
    .post('/api/auth/setup')
    .send({
      email: 'owner@example.com',
      username: 'owner',
      password: 'secret123',
    })
    .expect(201);

  // Create an anyone share so a guest session can be created.
  const createShare = await ownerAgent
    .post('/api/shares')
    .send({
      sourcePath: 'Projects',
      accessMode: 'readonly',
      sharingType: 'anyone',
    })
    .expect(201);

  const token = createShare.body?.shareToken;
  assert.ok(token);

  // Simulate a guest opening the share link to create a guest session.
  const guestAccess = await request(app)
    .get(`/api/share/${token}/access`)
    .expect(200);

  const guestSessionId = guestAccess.body?.guestSessionId;
  assert.ok(guestSessionId);

  // Now simulate the logged-in user making a request while a stale guest session is still present.
  // (Matches the real-world case where a guest session cookie/header lingers after login.)
  const browse = await ownerAgent
    .get('/api/browse/Projects')
    .set('X-Guest-Session', guestSessionId)
    .expect(200);

  const names = (browse.body.items || []).map((item) => item.name);
  assert.ok(names.includes('hello.txt'));
});
