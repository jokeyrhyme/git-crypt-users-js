#!/usr/bin/env node

/* eslint-disable no-console */
'use strict';

const execa = require('execa');

const { isClean } = require('../lib/git.js');
const {
  addUser,
  getUserIds,
  isLocked,
  rotateKey,
} = require('../lib/git-crypt.js');
const {
  getLocalPublicKey,
  getUsernames,
  listKnownPublicKeys,
  parsePublicKeys,
} = require('../lib/gpg.js');

console.log(`
git-crypt-users-rotate: generates a new key, re-encrypts encrypted files, and re-adds current git-crypt users
`);

// TODO: detect git project root instead of assuming it
const cwd = process.cwd();

(async () => {
  try {
    const { stderr } = await execa('git', ['crypt', '--version']);
    console.log(`git crypt --version:\n${stderr}\n`);
  } catch (err) {
    console.error(`git crypt --version failed: possibly not in PATH?`);
    throw err;
  }

  if (await isLocked({ cwd })) {
    console.error('error: locked! must git-crypt unlock first!');
    process.exitCode = 1;
    return;
  }

  if (!await isClean({ cwd })) {
    console.error('error: git repository is unclean / has uncommitted changes');
    process.exitCode = 1;
    return;
  }

  const knownKeys = await listKnownPublicKeys();
  const userIds = await getUserIds({ cwd });

  const knownUsers = userIds
    .filter(keyId => knownKeys.includes(keyId))
    .filter(async keyId => {
      const publicKey = await getLocalPublicKey(keyId);
      if (!publicKey) {
        return false;
      }
      const parsedKey = parsePublicKeys(publicKey);
      if (parsedKey.revocationSignature) {
        return false; // revoked!
      }
      return true;
    });

  if (knownUsers.length < 1) {
    console.error('error: no matching keys in your GNUPG keyring!');
    process.exitCode = 1;
    return;
  }
  if (knownUsers.length < userIds.length / 2) {
    console.error('error: <50% of git-crypt users are in your GNUPG keyring!');
    process.exitCode = 1;
    return;
  }

  await rotateKey({ cwd });

  for (const userId of knownUsers) {
    try {
      await addUser({ cwd, userId });
    } catch (err) {
      const usernames = await getUsernames(userId);
      console.error(
        `error: unable to add user: ${usernames}`,
        err.stderr || err
      );
    }
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
