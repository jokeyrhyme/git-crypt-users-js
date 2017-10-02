'use strict';

const execa = require('execa');

const { HKP, key } = require('openpgp');

const pgp = new HKP('https://keyserver.pgp.com');
const mit = new HKP('https://pgp.mit.edu');

const FINGERPRINT_REGEXP = /[0-9A-F]{40}/m;

async function getLocalPublicKey(keyId) {
  const { stdout } = await execa('gpg', ['--export', '--armor', keyId]);
  if (!stdout.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----')) {
    return null;
  }
  return stdout;
}

async function getUsernames(keyId) {
  const parsedKey = parsePublicKeys(await getLocalPublicKey(keyId));
  return (
    parsedKey.users
      .map(user => (user && user.userId && user.userId.userid) || 'unknown')
      .join(', ') || ''
  );
}

async function listKnownPublicKeys() {
  const { stdout } = await execa('gpg', ['--list-public-keys', '--textmode']);

  // stdout starts with:
  // /Users/$USER/.gnupg/pubring.kbx
  // ---------------------------------
  const [, output] = stdout.split('---------------------------------');

  return output
    .split('\n\n')
    .map(entry => {
      const [keyId] = entry.match(FINGERPRINT_REGEXP) || [];
      return keyId || '';
    })
    .filter(keyId => !!keyId);
}

async function lookupPublicKey(keyId) {
  return (await mit.lookup({ keyId })) || (await pgp.lookup({ keyId }));
}

function parsePublicKeys(asciiArmor) {
  const { keys } = key.readArmored(asciiArmor);
  if (keys.length !== 1) {
    throw new TypeError(
      'parsePublicKeys() expects argument to contain a single public key'
    );
  }
  return keys[0];
}

module.exports = {
  getLocalPublicKey,
  getUsernames,
  listKnownPublicKeys,
  lookupPublicKey,
  parsePublicKeys,
};
