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

async function listKnownPublicKeys() /* : Promise<string[]> */ {
  const { all, stdout } = await execa(await exe(), [
    '--list-keys',
    '--fingerprint',
    '--textmode',
  ]);
  debug(
    'listKnownPublicKeys(): gpg --list-keys --fingerprint --textmode\n%s',
    all,
  );

  return parseListing(stdout).map(entry => entry.fingerprint);
}

async function lookupPublicKey(keyId /* : string */) {
  return (await mit.lookup({ keyId })) || (await pgp.lookup({ keyId }));
}

/* ::
type ListingEntry = {
  email: string;
  fingerprint: string;
};
*/
function parseListing(listing /* : string */) /* : ListingEntry[] */ {
  const entries = [];
  let entry = { email: '', fingerprint: '' };

  const saveOldStartNew = () => {
    if (entry && entry.fingerprint) {
      entries.push(entry);
    }
    entry = { email: '', fingerprint: '' };
  };

  for (let line of listing.split('\n')) {
    line = line.trim();
    if (line.match(/^(pub|sec)\s/)) {
      // we are at the start of a new entry
      saveOldStartNew();
    }
    let noWhitespace = line.replace(/\s/g, '');
    if (line.startsWith('Key fingerprint = ')) {
      noWhitespace = noWhitespace.replace('Keyfingerprint=', '');
    }
    if (noWhitespace.match(/^[0-9A-F]{40}$/)) {
      entry.fingerprint = noWhitespace;
    }
    const [, email] = line.match(/<([^\s@]+@[^\s@]+)>/) || [];
    if (email) {
      entry.email = email;
    }
  }
  saveOldStartNew();
  debug('parseListing(): %O', entries);
  return entries;
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
  parseListing,
};
