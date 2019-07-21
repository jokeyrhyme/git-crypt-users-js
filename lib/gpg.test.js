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
  parseListing,
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

  describe('parseListing()', () => {
    it('parses output from gpg 2.1.11', () => {
      const listing = `/tmp/git-crypt-test--gpg-KHPaVv/pubring.kbx
-------------------------------------------
pub   rsa2048/589EF98F 2019-07-21 [SC]
      Key fingerprint = 1D5F 7BFE 54E5 C2E9 78AF  88FF 6BC3 D9B3 589E F98F
uid         [ultimate] Alice <alice@example.local>
sub   rsa2048/73AF806B 2019-07-21 [E]
pub   rsa2048/CC38658E 2019-07-21 [SC]
      Key fingerprint = 9A21 8AA0 BBB0 E64E B6AA  7731 7282 FA72 CC38 658E
uid         [ultimate] Bob <bob@example.local>
sub   rsa2048/568A60C0 2019-07-21 [E]
`;
      const got = parseListing(listing);
      expect(got).toContainEqual({
        email:       'alice@example.local',
        fingerprint: '1D5F7BFE54E5C2E978AF88FF6BC3D9B3589EF98F',
      });
      expect(got).toContainEqual({
        email:       'bob@example.local',
        fingerprint: '9A218AA0BBB0E64EB6AA77317282FA72CC38658E',
      });
    });

    it('parses output from gpg 2.2.16', () => {
      const listing = `/tmp/git-crypt-test--gpg-zr7rYT/pubring.kbx
-------------------------------------------
sec   rsa2048 2019-07-21 [SC]
      8E82A43990918AE0BC5AF076438FBEFBB18785ED
uid           [ultimate] Alice <alice@example.local>
ssb   rsa2048 2019-07-21 [E]

sec   rsa2048 2019-07-21 [SC]
      1CC8653C86167701289AB6D398402AEC113CE2BB
uid           [ultimate] Bob <bob@example.local>
ssb   rsa2048 2019-07-21 [E]

`;
      const got = parseListing(listing);
      expect(got).toContainEqual({
        email:       'alice@example.local',
        fingerprint: '8E82A43990918AE0BC5AF076438FBEFBB18785ED',
      });
      expect(got).toContainEqual({
        email:       'bob@example.local',
        fingerprint: '1CC8653C86167701289AB6D398402AEC113CE2BB',
      });
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
