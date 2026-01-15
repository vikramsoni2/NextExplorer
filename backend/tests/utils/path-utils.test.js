const test = require('node:test');
const assert = require('node:assert/strict');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const { setupTestEnv } = require('../helpers/env-test-utils');

let envContext;
let pathUtils;

test.before(async () => {
  envContext = await setupTestEnv({
    tag: 'path-utils-test-',
    modules: ['src/utils/pathUtils'],
  });
  pathUtils = envContext.requireFresh('src/utils/pathUtils');
});

test.after(async () => {
  await envContext.cleanup();
});

test('normalizeRelativePath normalizes slashes and rejects traversal', () => {
  assert.strictEqual(pathUtils.normalizeRelativePath('folder//nested'), 'folder/nested');
  assert.strictEqual(pathUtils.normalizeRelativePath('/'), '');
  assert.strictEqual(pathUtils.normalizeRelativePath(''), '');
  assert.strictEqual(pathUtils.normalizeRelativePath('./foo/../bar'), 'bar');
  assert.throws(() => pathUtils.normalizeRelativePath('..'), /Invalid path/);
});

test('resolveVolumePath protects volume root boundaries', () => {
  const resolved = pathUtils.resolveVolumePath('photo/jpg');
  assert.strictEqual(resolved, path.resolve(envContext.volumeDir, 'photo/jpg'));
  assert.throws(() => pathUtils.resolveVolumePath('../outside'), /outside/);
});

test('combineRelativePath and splitName helpers behave consistently', () => {
  assert.strictEqual(pathUtils.combineRelativePath('a//b', 'file.txt'), 'a/b/file.txt');
  const { base, extension } = pathUtils.splitName('archive.tar.gz');
  assert.strictEqual(base, 'archive.tar');
  assert.strictEqual(extension, '.gz');
  const noExt = pathUtils.splitName('README');
  assert.strictEqual(noExt.base, 'README');
  assert.strictEqual(noExt.extension, '');
});

test('ensureValidName rejects invalid names', () => {
  assert.strictEqual(pathUtils.ensureValidName('Default'), 'Default');
  assert.throws(() => pathUtils.ensureValidName(''), /Name cannot be empty/);
  assert.throws(() => pathUtils.ensureValidName('bad/name'), /path separators/);
  assert.throws(() => pathUtils.ensureValidName('..'), /not allowed/);
});

test('findAvailableName and findAvailableFolderName avoid collisions', async () => {
  const filePath = path.join(envContext.volumeDir, 'duplicate.txt');
  await fsPromises.writeFile(filePath, 'data');
  const nextName = await pathUtils.findAvailableName(envContext.volumeDir, 'duplicate.txt');
  assert.strictEqual(nextName, 'duplicate (1).txt');
  const firstName = await pathUtils.findAvailableName(envContext.volumeDir, 'new.txt');
  assert.strictEqual(firstName, 'new.txt');

  await fsPromises.mkdir(path.join(envContext.volumeDir, 'Untitled Folder'));
  const folderName = await pathUtils.findAvailableFolderName(envContext.volumeDir);
  assert.strictEqual(folderName, 'Untitled Folder 2');
});

test('getUserFolderName defaults to stable id-first ordering', () => {
  const name = pathUtils.getUserFolderName({
    id: '11111111-2222-3333-4444-555555555555',
    username: 'alice',
    email: 'alice@example.com',
  });
  assert.strictEqual(name, '11111111-2222-3333-4444-555555555555');
});

test('getUserFolderName respects USER_FOLDER_NAME_ORDER', async () => {
  const customEnv = await setupTestEnv({
    tag: 'path-utils-user-folder-order-',
    modules: ['src/utils/pathUtils'],
    env: {
      USER_FOLDER_NAME_ORDER: 'username,id',
    },
  });

  try {
    const customPathUtils = customEnv.requireFresh('src/utils/pathUtils');

    const fromUsername = customPathUtils.getUserFolderName({
      id: '11111111-2222-3333-4444-555555555555',
      username: 'alice',
      email: 'alice@example.com',
    });
    assert.strictEqual(fromUsername, 'alice');

    const fallsBackToId = customPathUtils.getUserFolderName({
      id: '11111111-2222-3333-4444-555555555555',
      username: 'bad/name',
      email: 'alice@example.com',
    });
    assert.strictEqual(fallsBackToId, '11111111-2222-3333-4444-555555555555');
  } finally {
    await customEnv.cleanup();
  }
});

test('resolveItemPaths returns normalized relative and absolute paths', async () => {
  const item = { name: 'file.txt', path: 'docs/reports' };
  const resolved = await pathUtils.resolveItemPaths(item);
  assert.strictEqual(resolved.relativePath, 'docs/reports/file.txt');
  assert.strictEqual(
    resolved.absolutePath,
    path.resolve(envContext.volumeDir, 'docs/reports/file.txt')
  );
});
