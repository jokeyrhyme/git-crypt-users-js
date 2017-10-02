#!/usr/bin/env node

/* eslint-disable no-console */
'use strict';

const { getUserIds } = require('../lib/git-crypt.js');
const { getLocalPublicKey, parsePublicKeys } = require('../lib/gpg.js');

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

    const details = [keyId];
    const parsedKey = parsePublicKeys(result);

    for (const user of parsedKey.users || []) {
      if (!user || !user.userId || !user.userId.userid) {
        continue;
      }
      if (
        Array.isArray(user.revocationCertifications) &&
        user.revocationCertifications.length
      ) {
        continue;
      }
      details.push(user.userId.userid);
    }
    if (parsedKey.revocationSignature) {
      details.push('REVOKED!');
    }
    console.log(details.join(' '));
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
