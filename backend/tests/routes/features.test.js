const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

const backendPackage = require('../../package.json');
const { clearModuleCache, overrideEnv } = require('../helpers/env-test-utils');

const buildApp = () => {
  clearModuleCache('src/config/env');
  clearModuleCache('src/config/index');
  clearModuleCache('src/routes/features');

  const featureRoutes = require('../../src/routes/features');
  const app = express();
  app.use('/api', featureRoutes);
  return app;
};

test('features route exposes default feature flags and version metadata', async () => {
  const restoreEnv = overrideEnv({
    ONLYOFFICE_URL: undefined,
    ONLYOFFICE_FILE_EXTENSIONS: undefined,
    EDITOR_EXTENSIONS: undefined,
    SHOW_VOLUME_USAGE: undefined,
    SKIP_HOME: undefined,
    GIT_COMMIT: undefined,
    GIT_BRANCH: undefined,
    REPO_URL: undefined,
  });

  try {
    const app = buildApp();
    const response = await request(app).get('/api/features').expect(200);

    assert.strictEqual(response.body.onlyoffice.enabled, false);
    assert.deepEqual(response.body.onlyoffice.extensions, []);
    assert.deepEqual(response.body.editor.extensions, []);
    assert.strictEqual(response.body.volumeUsage.enabled, false);
    assert.strictEqual(response.body.navigation.skipHome, false);
    assert.strictEqual(response.body.version.app, backendPackage.version);
    assert.strictEqual(response.body.version.gitCommit, '');
    assert.strictEqual(response.body.version.gitBranch, '');
    assert.strictEqual(response.body.version.repoUrl, '');
  } finally {
    restoreEnv();
  }
});

test('features route reflects enabled editors, onlyoffice, and volume usage', async () => {
  const restoreEnv = overrideEnv({
    ONLYOFFICE_URL: 'https://desk.example.com',
    ONLYOFFICE_FILE_EXTENSIONS: '.docx, .XLSX',
    EDITOR_EXTENSIONS: '.MD,.txt',
    SHOW_VOLUME_USAGE: 'true',
    SKIP_HOME: 'true',
    GIT_COMMIT: 'abc123',
    GIT_BRANCH: 'main',
    REPO_URL: 'https://example.com/repo',
  });

  try {
    const app = buildApp();
    const response = await request(app).get('/api/features').expect(200);

    assert.strictEqual(response.body.onlyoffice.enabled, true);
    assert.deepEqual(response.body.onlyoffice.extensions, ['.docx', '.xlsx']);
    assert.deepEqual(response.body.editor.extensions, ['.md', '.txt']);
    assert.strictEqual(response.body.volumeUsage.enabled, true);
    assert.strictEqual(response.body.navigation.skipHome, true);
    assert.strictEqual(response.body.version.gitCommit, 'abc123');
    assert.strictEqual(response.body.version.gitBranch, 'main');
    assert.strictEqual(
      response.body.version.repoUrl,
      'https://example.com/repo',
    );
  } finally {
    restoreEnv();
  }
});
