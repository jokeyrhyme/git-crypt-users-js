/* @flow */
'use strict';

const { copyFile, mkdtemp, readdir, stat } = require('fs');
const { tmpdir } = require('os');
const { basename, dirname, join: joinPath } = require('path');
const { promisify } = require('util');

const execa = require('execa');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const which = require('which');

const { backupFiles, copyFiles, unlinkIfExists } = require('../lib/fs.js');
const {
  commitChanges,
  setLocalConfig,
  stage,
  unsetLocalConfig,
} = require('./git.js');
const { getUsernames } = require('./gpg.js');

const USER_KEYS_DIR = ['.git-crypt', 'keys', 'default', '0'];

// add-gpg-user
/* ::
type AddUserOptions = {
  cwd?: string,
  userId: string,
};
*/
async function addUser({
  cwd = process.cwd(),
  userId,
} /* : AddUserOptions */ = {}) {
  await execa(
    'git',
    ['crypt', 'add-gpg-user', '--no-commit', '--trusted', userId],
    { cwd },
  );
  const usernames = await getUsernames(userId);
  await commitChanges({ cwd, msg: `\`git crypt add-gpg-user\`: ${usernames}` });
}

/* ::
type BackupEncryptedFilesOptions = {
  cwd?: string,
};
*/
async function backupEncryptedFiles({
  cwd = process.cwd(),
} /* : BackupEncryptedFilesOptions */ = {}) {
  const { encrypted } = await getStatus({ cwd });

  const backupDir = await promisify(mkdtemp)(
    joinPath(tmpdir(), 'git-crypt-backup-'),
  );
  for (const filePath of encrypted) {
    await promisify(mkdirp)(dirname(joinPath(backupDir, filePath)));
    await promisify(copyFile)(
      joinPath(process.cwd(), filePath),
      joinPath(backupDir, filePath),
    );

    // ensure that the copy was successful
    const { size: currentSize } = await promisify(stat)(
      joinPath(process.cwd(), filePath),
    );
    const { size: backupSize } = await promisify(stat)(
      joinPath(backupDir, filePath),
    );
    if (currentSize !== backupSize) {
      throw new Error(
        `${filePath} backup size: got=${backupSize}, want=${currentSize}`,
      );
    }
  }
  return backupDir;
}

/* ::
type GetStatusOptions = {
  cwd?: string,
};
*/
async function getStatus({
  cwd = process.cwd(),
} /* : GetStatusOptions */ = {}) {
  const { stdout } = await execa('git', ['crypt', 'status'], {
    cwd,
  });
  return stdout
    .split('\n')
    .filter(f => !!f)
    .reduce(
      (result, line) => {
        const [status, filePath] = line.split(':').map(p => p.trim());
        result[status === 'encrypted' ? 'encrypted' : 'unencrypted'].push(
          filePath,
        );
        return result;
      },
      { encrypted: [], unencrypted: [] },
    );
}

/* ::
type GetUserIdsOptions = {
  cwd?: string,
};
*/
async function getUserIds({
  cwd = process.cwd(),
} /* : GetUserIdsOptions */ = {}) {
  const keyFiles = await promisify(readdir)(joinPath(cwd, ...USER_KEYS_DIR));
  return keyFiles
    .filter(keyFile => /^\w+\.gpg$/.test(keyFile))
    .map(keyFile => basename(keyFile, '.gpg'));
}

/* ::
type InitOptions = {
  cwd?: string,
};
*/
async function init({ cwd = process.cwd() } /* : InitOptions */ = {}) {
  await execa('git', ['crypt', 'init'], { cwd });
}

/* ::
type InstallHooksOptions = {
  cwd?: string,
};
*/
async function installHooks({
  cwd = process.cwd(),
} /* : InstallHooksOptions */ = {}) {
  const command = await promisify(which)('git-crypt');
  await setLocalConfig({
    cwd,
    key:   'diff.git-crypt.textconv',
    value: `"${command}" diff`,
  });
  await setLocalConfig({
    cwd,
    key:   'filter.git-crypt.clean',
    value: `"${command}" clean`,
  });
  await setLocalConfig({ cwd, key: 'filter.git-crypt.required', value: true });
  await setLocalConfig({
    cwd,
    key:   'filter.git-crypt.smudge',
    value: `"${command}" smudge`,
  });
}

/* ::
type IsLockedOptions = {
  cwd?: string,
};
*/
async function isLocked({ cwd = process.cwd() } /* : IsLockedOptions */ = {}) {
  const { stdout } = await execa(
    'git',
    ['ls-tree', '-r', 'master', '--name-only'],
    {
      cwd,
    },
  );
  const filesInMaster = stdout
    .split('\n')
    .map(f => f.trim())
    .filter(f => !!f);

  const { code } = await execa(
    'grep',
    ['-qsa', '\\x00GITCRYPT', ...filesInMaster],
    { cwd, reject: false, stdio: 'ignore' },
  );
  return code === 0; // non-zero exit code if locked
}

/* ::
type RemoveHooksOptions = {
  cwd?: string,
};
*/
async function removeHooks({
  cwd = process.cwd(),
} /* : RemoveHooksOptions */ = {}) {
  await unsetLocalConfig({ cwd, key: 'diff.git-crypt.textconv' });
  await unsetLocalConfig({ cwd, key: 'filter.git-crypt.clean' });
  await unsetLocalConfig({ cwd, key: 'filter.git-crypt.required' });
  await unsetLocalConfig({ cwd, key: 'filter.git-crypt.smudge' });
}

/* ::
type RotateKeyOptions = {
  cwd?: string,
};
*/
async function rotateKey({
  cwd = process.cwd(),
} /* : RotateKeyOptions */ = {}) {
  let backupDir;

  try {
    const { encrypted } = await getStatus({ cwd });

    // backing up decrypted files
    backupDir = await backupFiles({
      source:    cwd,
      filePaths: encrypted,
    });

    // deleting files to encrypt
    for (const filePath of encrypted) {
      await unlinkIfExists(joinPath(cwd, filePath));
    }
    await commitChanges({
      cwd,
      msg: 'git-crypt: deleted encrypted files',
    });

    // removing git-crypt hooks
    await removeHooks({ cwd });

    // deleting .git-crypt .git/git-crypt
    await promisify(rimraf)(joinPath(cwd, '.git-crypt'));
    await promisify(rimraf)(joinPath(cwd, '.git/git-crypt'));
    await commitChanges({ cwd, msg: '`rm -rf .git-crypt .git/git-crypt`' });

    // creating new git-crypt "vault"
    await init({ cwd });

    // restoring files to encrypt
    await copyFiles({
      source:    backupDir,
      target:    cwd,
      filePaths: encrypted,
    });
    for (const filePath of encrypted) {
      await stage({ cwd, filePath });
    }
    await commitChanges({
      cwd,
      msg: 'git-crypt: restore encrypted files',
    });

    // installing git-crypt hooks
    await installHooks({ cwd });
  } finally {
    await promisify(rimraf)(backupDir);
  }
}

module.exports = {
  addUser,
  backupEncryptedFiles,
  getStatus,
  getUserIds,
  init,
  installHooks,
  isLocked,
  removeHooks,
  rotateKey,
};
