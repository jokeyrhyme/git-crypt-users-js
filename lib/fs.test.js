/* eslint-env jest */
'use strict';

const {
  access,

  mkdtemp,
  readdir,
  readFile,
  writeFile,
} = require('fs');
const { tmpdir } = require('os');
const { basename, join: joinPath } = require('path');
const { promisify } = require('util');

const rimraf = require('rimraf');

const { backupFiles, copyFiles, unlinkIfExists, which } = require('./fs.js');

const PROJECT_DIR = joinPath(__dirname, '..');

describe('backupFiles()', () => {
  it('copies desired filepaths including sub-folders', async () => {
    const filePaths = ['lib/fs.js', 'package.json'];
    const backupDir = await backupFiles({ source: PROJECT_DIR, filePaths });

    expect(basename(backupDir)).toMatch(/^git-crypt-backup-/);

    for (let f of filePaths) {
      const [a, b] = await Promise.all([
        promisify(readFile)(joinPath(PROJECT_DIR, f), 'utf8'),
        promisify(readFile)(joinPath(backupDir, f), 'utf8'),
      ]);
      expect(a).toEqual(b);
    }

    await promisify(rimraf)(backupDir);
  });
});

describe('copyFiles()', () => {
  let tempDir;

  afterEach(async () => {
    if (tempDir) {
      await promisify(rimraf)(tempDir);
    }
  });

  beforeEach(async () => {
    tempDir = await promisify(mkdtemp)(joinPath(tmpdir(), 'git-crypt-test-'));
  });

  it('does nothing with empty filepaths', async () => {
    await copyFiles({ source: PROJECT_DIR, target: tempDir, filePaths: [] });

    const got = await promisify(readdir)(tempDir);
    expect(got).toHaveLength(0);
  });

  it('copies desired filepaths including sub-folders', async () => {
    const filePaths = ['lib/fs.js', 'package.json'];
    await copyFiles({ source: PROJECT_DIR, target: tempDir, filePaths });

    for (let f of filePaths) {
      const [a, b] = await Promise.all([
        promisify(readFile)(joinPath(PROJECT_DIR, f), 'utf8'),
        promisify(readFile)(joinPath(tempDir, f), 'utf8'),
      ]);
      expect(a).toEqual(b);
    }
  });
});

describe('unlinkIfExists()', () => {
  let tempDir;

  afterEach(async () => {
    if (tempDir) {
      await promisify(rimraf)(tempDir);
    }
  });

  beforeEach(async () => {
    tempDir = await promisify(mkdtemp)(joinPath(tmpdir(), 'git-crypt-test-'));
  });

  it('deletes pre-existing file', async () => {
    const filePath = joinPath(tempDir, 'file.txt');
    await promisify(writeFile)(filePath, 'hello, world!', 'utf8');

    await unlinkIfExists(filePath);

    try {
      await promisify(access)(filePath);
    } catch (err) {
      expect(err).toBeDefined(); // yay, cannot access anymore
      return;
    }
    throw new Error('hmmm, somehow we can still access the file :(');
  });

  it('succeeds if file already gone', async () => {
    await unlinkIfExists(joinPath(tempDir, 'does-not-exist'));
  });
});

describe('which()', () => {
  it('find `env`', async () => {
    const got = await which('env');
    expect(got).toEqual('/usr/bin/env');
  });
});
