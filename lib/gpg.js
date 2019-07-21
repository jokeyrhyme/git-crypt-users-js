/* @flow */
'use strict';

const { promisify } = require('util');

const debug = require('debug')('gpg');
const execa = require('execa');
const which = require('which');

const { HKP, key } = require('openpgp');
global.fetch = require('node-fetch'); // needed for opengpg lookups

/* :: import type { ParsedKey } from '../types.js' */

const pgp = new HKP('https://keyserver.pgp.com');
const mit = new HKP('https://pgp.mit.edu');

const FINGERPRINT_REGEXP = /[0-9A-F]{40}/m;

async function exe() /* : Promise<string> */ {
  try {
    return await promisify(which)('gpg2');
  } catch (err) {
    return await promisify(which)('gpg');
  }
}

async function getLocalPublicKey(keyId /* : string */) {
  const { all, stdout } = await execa(await exe(), [
    '--export',
    '--armor',
    keyId,
  ]);
  debug('getLocalPublicKey(): gpg --export --armor %s\n%s', keyId, all);
  if (!stdout.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----')) {
    return null;
  }
  return stdout;
}

async function getUsernames(keyId /* : string */) {
  const parsedKey = await parsePublicKeys(await getLocalPublicKey(keyId));
  return (
    parsedKey.users
      .map(user => (user && user.userId && user.userId.userid) || 'unknown')
      .join(', ') || ''
  );
}

async function listKnownPublicKeys() {
  const { all, stdout } = await execa(await exe(), [
    '--list-keys',
    '--fingerprint',
    '--textmode',
  ]);
  debug('listKnownPublicKeys(): gpg --list-keys --fingerprint --textmode\n%s', all);

  return stdout
    .split('\n\n')
    .map(entry => {
      const [keyId] = entry.match(FINGERPRINT_REGEXP) || [];
      return keyId || '';
    })
    .filter(keyId => !!keyId);
}

async function lookupPublicKey(keyId /* : string */) {
  return (await mit.lookup({ keyId })) || (await pgp.lookup({ keyId }));
}

async function parsePublicKeys(
  asciiArmor /* :? string */,
) /* : Promise<ParsedKey> */ {
  const { keys = [] } = await key.readArmored(asciiArmor);
  if (keys.length !== 1) {
    throw new TypeError(
      'parsePublicKeys() expects argument to contain a single public key',
    );
  }
  return keys[0];
}

module.exports = {
  exe,
  getLocalPublicKey,
  getUsernames,
  listKnownPublicKeys,
  lookupPublicKey,
  parsePublicKeys,
};
