const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

const { clearModuleCache } = require('../helpers/env-test-utils');

const buildApp = () => {
  clearModuleCache('src/routes/health');

  const healthRoutes = require('../../src/routes/health');
  const app = express();
  app.use('/', healthRoutes);
  return app;
};

test('GET /healthz returns ok', async () => {
  const app = buildApp();
  const response = await request(app).get('/healthz').expect(200);

  assert.deepEqual(response.body, { status: 'ok' });
});

test('GET /readyz returns ready', async () => {
  const app = buildApp();
  const response = await request(app).get('/readyz').expect(200);

  assert.deepEqual(response.body, { status: 'ready' });
});
