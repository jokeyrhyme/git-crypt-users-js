/* @flow */
'use strict';

const execa = require('execa');

/* ::
type CommitChangesOptions = {
  cwd?: string,
  msg?: string,
};
*/
async function commitChanges({
  cwd = process.cwd(),
  msg = 'changed files',
} /* : CommitChangesOptions */ = {}) {
  await execa('git', ['commit', '-a', '-m', msg], { cwd });
}

/* ::
type IsCleanOptions = {
  cwd?: string,
};
*/
async function isClean({ cwd = process.cwd() } /* : IsCleanOptions */ = {}) {
  const { code } = await execa('git', ['diff-index', '--quiet', 'HEAD', '--'], {
    cwd,
    reject: false,
    stdio:  'ignore',
  });
  return code === 0; // non-zero exit code if unclean
}

/* ::
type ListLocalConfigKeysOptions = {
  cwd?: string,
};
*/ async function listLocalConfigKeys({
  cwd = process.cwd(),
} /* : ListLocalConfigKeysOptions */ = {}) {
  const { stdout } = await execa(
    'git',
    ['config', '--local', '--list', '--name-only'],
    {
      cwd,
    },
  );
  return stdout
    .split('\n')
    .map(line => line.trim())
    .filter(line => !!line);
}

/* ::
type SetLocalConfigOptions = {
  cwd?: string,
  key: string,
  value: any,
};
*/
async function setLocalConfig({
  cwd = process.cwd(),
  key,
  value,
} /* : SetLocalConfigOptions */ = {}) {
  const flags = ['--local'];
  if (typeof value === 'boolean') {
    flags.push('--bool');
  }
  await execa('git', ['config', ...flags, key, value], { cwd });
}

/* ::
type StageOptions = {
  cwd?: string,
  filePath: string,
};
*/
async function stage({
  cwd = process.cwd(),
  filePath,
} /* : StageOptions */ = {}) {
  await execa('git', ['add', filePath], { cwd });
}

/* ::
type UnsetLocalConfigOptions = {
  cwd?: string,
  key: string,
};
*/
async function unsetLocalConfig({
  cwd = process.cwd(),
  key,
} /* : UnsetLocalConfigOptions */ = {}) {
  const keys = await listLocalConfigKeys({ cwd });
  if (keys.includes(key)) {
    await execa('git', ['config', '--local', '--unset', key], {
      cwd,
    });
  }
}

module.exports = {
  commitChanges,
  isClean,
  listLocalConfigKeys,
  setLocalConfig,
  stage,
  unsetLocalConfig,
};
