const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const express = require('express');
const request = require('supertest');
const { setupTestEnv, clearModuleCache } = require('../helpers/env-test-utils');

let envContext;

test.before(async () => {
  envContext = await setupTestEnv({
    tag: 'shares-routes-test-',
    env: {
      USER_VOLUMES: 'true',
    },
    modules: [
      'src/services/db',
      'src/services/users',
      'src/services/userVolumesService',
      'src/services/sharesService',
      'src/utils/pathUtils',
      'src/routes/shares',
    ],
  });
});

test.after(async () => {
  await envContext.cleanup();
});

const buildApp = ({ user } = {}) => {
  if (!envContext) throw new Error('Test environment not initialized');

  clearModuleCache('src/config/env');
  clearModuleCache('src/config/index');

  const sharesRoutes = envContext.requireFresh('src/routes/shares');

  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    if (user) req.user = user;
    next();
  });

  app.use('/api/shares', sharesRoutes);
  app.use('/api/share', sharesRoutes);
  return app;
};

test('user volumes: can create and browse share from assigned volume path', async () => {
  const usersService = envContext.requireFresh('src/services/users');
  const userVolumesService = envContext.requireFresh('src/services/userVolumesService');

  const assignedRoot = path.join(envContext.tmpRoot, 'assigned-volume');
  await fs.mkdir(assignedRoot, { recursive: true });

  const sharedFolder = path.join(assignedRoot, 'myfolder');
  await fs.mkdir(sharedFolder, { recursive: true });
  await fs.writeFile(path.join(sharedFolder, 'hello.txt'), 'hello');

  const user = await usersService.createLocalUser({
    email: 'user@example.com',
    username: 'user',
    displayName: 'User',
    password: 'secret123',
    roles: ['user'],
  });

  const vol = await userVolumesService.addVolumeToUser({
    userId: user.id,
    label: 'MyVol',
    volumePath: assignedRoot,
    accessMode: 'readwrite',
  });

  const app = buildApp({ user });

  const create = await request(app)
    .post('/api/shares')
    .send({
      sourcePath: 'MyVol/myfolder',
      accessMode: 'readonly',
      sharingType: 'anyone',
    })
    .expect(201);

  assert.ok(create.body.shareToken);
  assert.equal(create.body.sourceSpace, 'user_volume');
  assert.equal(create.body.sourcePath, `${vol.id}/myfolder`);

  const browse = await request(app)
    .get(`/api/share/${create.body.shareToken}/browse/`)
    .expect(200);

  const names = (browse.body.items || []).map((item) => item.name);
  assert.ok(names.includes('hello.txt'));
});

test('user volumes: cannot create read-write share for readonly assigned volume', async () => {
  const usersService = envContext.requireFresh('src/services/users');
  const userVolumesService = envContext.requireFresh('src/services/userVolumesService');

  const assignedRoot = path.join(envContext.tmpRoot, 'assigned-volume-readonly');
  await fs.mkdir(assignedRoot, { recursive: true });
  await fs.mkdir(path.join(assignedRoot, 'folder'), { recursive: true });

  const user = await usersService.createLocalUser({
    email: 'user2@example.com',
    username: 'user2',
    displayName: 'User2',
    password: 'secret123',
    roles: ['user'],
  });

  await userVolumesService.addVolumeToUser({
    userId: user.id,
    label: 'ReadOnlyVol',
    volumePath: assignedRoot,
    accessMode: 'readonly',
  });

  const app = buildApp({ user });

  await request(app)
    .post('/api/shares')
    .send({
      sourcePath: 'ReadOnlyVol/folder',
      accessMode: 'readwrite',
      sharingType: 'anyone',
    })
    .expect(400);
});
