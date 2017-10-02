#!/usr/bin/env node

/* eslint-disable no-console */
'use strict';

const { mkdtemp, writeFile } = require('fs');
const { tmpdir } = require('os');
const path = require('path');
const { promisify } = require('util');

const execa = require('execa');
const rimraf = require('rimraf');

const { getUserIds } = require('../lib/git-crypt.js');
const { listKnownPublicKeys, lookupPublicKey } = require('../lib/gpg.js');

console.log(`
git-crypt-users-import: loads git-crypt users' public keys into your GNUPG keyring
`);

(async () => {
  try {
    const { stdout } = await execa('gpg', ['--version']);
    console.log(`gpg --version:\n${stdout}\n`);
  } catch (err) {
    console.error(`gpg --version failed: possibly not in PATH?`);
    throw err;
  }

  const tempDir = await promisify(mkdtemp)(
    path.join(tmpdir(), 'git-crypt-users-')
  );

  const knownKeys = await listKnownPublicKeys();

  for (const keyId of await getUserIds({ cwd: process.cwd() })) {
    if (knownKeys.includes(keyId)) {
      console.log(`${keyId} known :D`);
      continue;
    }

    const keyPath = path.join(tempDir, `${keyId}.pub.gpg`);

    const result = await lookupPublicKey(keyId);

    if (!result) {
      console.log(`${keyId} not found :(`);
      continue;
    }

    await promisify(writeFile)(keyPath, result, 'utf8');

    await execa('gpg', ['--import', keyPath]);
    console.log(`${keyId} imported :)`);
  }

  await promisify(rimraf)(tempDir);
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
