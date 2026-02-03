const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { setupTestEnv } = require('../helpers/env-test-utils');

const buildApp = (routes, { notFoundHandler, errorHandler }) => {
  const app = express();
  app.use('/api', routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

test('Collabora WOPI endpoints reject missing token', async () => {
  const env = await setupTestEnv({
    tag: 'collabora-wopi-',
    modules: [
      'src/routes/collabora',
      'src/services/wopiLockService',
      'src/middleware/errorHandler',
    ],
    env: {
      COLLABORA_URL: 'https://collabora.example.com',
      COLLABORA_SECRET: 'test-collabora-secret',
    },
  });

  try {
    const collaboraRoutes = env.requireFresh('src/routes/collabora');
    const errorMiddleware = env.requireFresh('src/middleware/errorHandler');
    const app = buildApp(collaboraRoutes, errorMiddleware);

    const response = await request(app).get('/api/collabora/wopi/files/file-1').expect(401);
    assert.equal(response.body?.error?.statusCode, 401);
  } finally {
    await env.cleanup();
  }
});

test('Collabora WOPI GetFile and PutFile work with a valid token', async () => {
  const env = await setupTestEnv({
    tag: 'collabora-wopi-',
    modules: ['src/routes/collabora', 'src/config/index', 'src/middleware/errorHandler'],
    env: {
      COLLABORA_URL: 'https://collabora.example.com',
      COLLABORA_SECRET: 'test-collabora-secret',
    },
  });

  try {
    const { collabora } = env.requireFresh('src/config/index');
    const collaboraRoutes = env.requireFresh('src/routes/collabora');
    const errorMiddleware = env.requireFresh('src/middleware/errorHandler');
    const app = buildApp(collaboraRoutes, errorMiddleware);

    const abs = path.join(env.tmpRoot, 'sample.docx');
    await fs.writeFile(abs, Buffer.from('original'));

    const fileId = 'file-1';
    const accessToken = jwt.sign(
      {
        fileId,
        absolutePath: abs,
        canWrite: true,
        userId: 'user-1',
        userName: 'Test User',
      },
      collabora.secret,
      { algorithm: 'HS256', expiresIn: 60 }
    );

    const getResponse = await request(app)
      .get(`/api/collabora/wopi/files/${fileId}/contents`)
      .query({ access_token: accessToken })
      .expect(200);

    const bodyText = Buffer.isBuffer(getResponse.body)
      ? getResponse.body.toString('utf8')
      : String(getResponse.text || '');
    assert.equal(bodyText, 'original');

    await request(app)
      .post(`/api/collabora/wopi/files/${fileId}/contents`)
      .query({ access_token: accessToken })
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('updated'))
      .expect(200);

    const updated = await fs.readFile(abs, 'utf8');
    assert.equal(updated, 'updated');
  } finally {
    await env.cleanup();
  }
});
