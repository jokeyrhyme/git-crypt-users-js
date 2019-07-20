#!/usr/bin/env node

/* @flow */
/* eslint-disable no-console */
'use strict';

const { getUserIds } = require('../lib/git-crypt.js');
const {
  getLocalPublicKey,
  getUsernames,
  parsePublicKeys,
} = require('../lib/gpg.js');

console.log(`
git-crypt-users-list: lists git-crypt users according to your GNUPG keyring
`);

(async () => {
  for (const keyId of await getUserIds({ cwd: process.cwd() })) {
    const result = await getLocalPublicKey(keyId);

    if (!result) {
      console.log(`${keyId} not in local keychain :( try "import"`);
      continue;
    }

    const details = [keyId, await getUsernames(keyId)];
    const parsedKey = await parsePublicKeys(result);

    const hasRevokedUser = parsedKey.users.some(
      user =>
        Array.isArray(user.revocationCertifications) &&
        user.revocationCertifications.length,
    );
    if (parsedKey.revocationSignature || hasRevokedUser) {
      details.push('REVOKED!');
    }

    console.log(details.join(' '));
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
