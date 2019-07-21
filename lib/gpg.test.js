/* eslint-env jest */
'use strict';

const { mkdtemp } = require('fs');
const { tmpdir } = require('os');
const { join: joinPath } = require('path');
const { promisify } = require('util');

const execa = require('execa');
const rimraf = require('rimraf');

const {
  exe,
  getLocalPublicKey,
  getUsernames,
  listKnownPublicKeys,
  lookupPublicKey,
  parsePublicKeys,
} = require('./gpg');

describe('gpg', () => {
  let tempDir;

  afterAll(async () => {
    if (tempDir) {
      await promisify(rimraf)(tempDir);
    }
    delete process.env.GNUPGHOME;
  });

  beforeAll(async () => {
    tempDir = await promisify(mkdtemp)(
      joinPath(tmpdir(), 'git-crypt-test--gpg-'),
    );
    process.env.DEBUG = 'gpg';
    process.env.GNUPGHOME = tempDir;
    await execa(await exe(), ['--gen-key', '--batch'], {
      input: [
        'Key-Type: default',
        'Subkey-Type: default',
        'Passphrase: alice',
        'Name-Real: Alice',
        'Name-Email: alice@example.local',
        '%commit',
      ].join('\n'),
    });
    await execa(await exe(), ['--gen-key', '--batch'], {
      input: [
        'Key-Type: default',
        'Subkey-Type: default',
        'Passphrase: bob',
        'Name-Real: Bob',
        'Name-Email: bob@example.local',
        '%commit',
      ].join('\n'),
    });

    // eslint-disable-next-line no-console
    console.log('listing keys in test keyring:');
    await execa(await exe(), ['-K'], { stderr: 'inherit', stdout: 'inherit' });
  });

  describe('getLocalPublicKey()', () => {
    it('finds ASCII Armor for Alice or Bob', async () => {
      const keyIds = await listKnownPublicKeys();
      expect(keyIds).toHaveLength(2);

      const [keyId] = keyIds;
      const got = await getLocalPublicKey(keyId);
      expect(got).toMatch('-BEGIN PGP PUBLIC KEY BLOCK-');
      expect(got).toMatch('-END PGP PUBLIC KEY BLOCK-');
    });
  });

  describe('getUsernames()', () => {
    it('finds usernames for Alice and Bob', async () => {
      const keyIds = await listKnownPublicKeys();
      expect(keyIds).toHaveLength(2);

      const got = await Promise.all(keyIds.map(getUsernames));
      expect(got).toHaveLength(2);
      expect(got).toContain('Alice <alice@example.local>');
      expect(got).toContain('Bob <bob@example.local>');
    });
  });

  describe('listKnownPublicKeys()', () => {
    it('finds public keys for Alice and Bob', async () => {
      const got = await listKnownPublicKeys();
      expect(got).toHaveLength(2);
      for (const keyId of got) {
        expect(typeof keyId).toBe('string');
      }

      const unique = Array.from(new Set(got));
      expect(unique).toHaveLength(2);
    });
  });

  describe('lookupPublicKey()', () => {
    it('finds the public key for Hashicorp', async () => {
      jest.setTimeout(30 * 1000);
      try {
        const got = await lookupPublicKey(
          '91A6E7F85D05C65630BEF18951852D87348FFC4C',
        );
        expect(got).toMatch('-BEGIN PGP PUBLIC KEY BLOCK-');
        expect(got).toMatch('-END PGP PUBLIC KEY BLOCK-');
      } catch (err) {
        // noop
        // we're just testing the result when there is one,
        // we don't care if the keyserver is having a bad day
      }
    });
  });

  describe('parsePublicKeys()', () => {
    it('parses ASCII Armor for Alice or Bob', async () => {
      const keyIds = await listKnownPublicKeys();
      expect(keyIds).toHaveLength(2);

      const [keyId] = keyIds;
      const asciiArmor = await getLocalPublicKey(keyId);
      const got = await parsePublicKeys(asciiArmor);
      expect(typeof got.users[0].userId.userid).toBe('string');
    });

    it('throws when not given a valid ASCII Armor', async () => {
      return expect(parsePublicKeys('')).rejects.toMatchObject(
        new TypeError(
          'parsePublicKeys() expects argument to contain a single public key',
        ),
      );
    });
  });
});
