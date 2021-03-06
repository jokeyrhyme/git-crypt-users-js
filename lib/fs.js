/* @flow */
'use strict';

const { copyFile, mkdtemp, stat, unlink } = require('fs');
const { tmpdir } = require('os');
const { dirname, join: joinPath } = require('path');
const { promisify } = require('util');

const mkdirp = require('mkdirp');

/* ::
type BackupFilesOptions = {
  filePaths?: string[],
  source: string,
};
*/
async function backupFiles({
  source,
  filePaths = [],
} /* : BackupFilesOptions */ = {}) {
  const backupDir = await promisify(mkdtemp)(
    joinPath(tmpdir(), 'git-crypt-backup-'),
  );
  await copyFiles({ source, target: backupDir, filePaths });
  return backupDir;
}

/* ::
type CopyFilesOptions = {
  filePaths?: string[],
  source: string,
  target: string,
};
*/
async function copyFiles({
  source,
  target,
  filePaths = [],
} /* : CopyFilesOptions */ = {}) {
  for (const filePath of filePaths) {
    await promisify(mkdirp)(dirname(joinPath(target, filePath)));
    await promisify(copyFile)(
      joinPath(source, filePath),
      joinPath(target, filePath),
    );

    // ensure that the copy was successful
    const { size: currentSize } = await promisify(stat)(
      joinPath(source, filePath),
    );
    const { size: targetSize } = await promisify(stat)(
      joinPath(target, filePath),
    );
    if (currentSize !== targetSize) {
      throw new Error(
        `${filePath} target size: got=${targetSize}, want=${currentSize}`,
      );
    }
  }
}

async function unlinkIfExists(filePath /* : string */) {
  try {
    await promisify(unlink)(filePath);
  } catch (err) {
    // it's okay if file is already gone
    if (err.code === 'ENOENT') {
      return;
    }
    throw err;
  }
}

module.exports = {
  backupFiles,
  copyFiles,
  unlinkIfExists,
};
