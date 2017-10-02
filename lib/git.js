'use strict';

const execa = require('execa');

async function commitChanges(
  { cwd = process.cwd(), msg = 'changed files' } = {}
) {
  await execa('git', ['commit', '-a', '-m', msg], { cwd });
}

async function isClean({ cwd = process.cwd() } = {}) {
  const { code } = await execa('git', ['diff-index', '--quiet', 'HEAD', '--'], {
    cwd,
    reject: false,
    stdio: 'ignore',
  });
  return code === 0; // non-zero exit code if unclean
}

async function listLocalConfigKeys({ cwd = process.cwd() } = {}) {
  const { stdout } = await execa(
    'git',
    ['config', '--local', '--list', '--name-only'],
    {
      cwd,
    }
  );
  return stdout
    .split('\n')
    .map(line => line.trim())
    .filter(line => !!line);
}

async function unsetLocalConfig({ cwd = process.cwd(), key } = {}) {
  const keys = await listLocalConfigKeys({ cwd });
  if (keys.includes(key)) {
    await execa('git', ['config', '--local', '--unset', key], {
      cwd,
    });
  }
}

async function setLocalConfig({ cwd = process.cwd(), key, value } = {}) {
  const flags = ['--local'];
  if (typeof value === 'boolean') {
    flags.push('--bool');
  }
  await execa('git', ['config', ...flags, key, value], { cwd });
}

async function stage({ cwd = process.cwd(), filePath } = {}) {
  await execa('git', ['add', filePath], { cwd });
}

module.exports = {
  commitChanges,
  isClean,
  listLocalConfigKeys,
  unsetLocalConfig,
  setLocalConfig,
  stage,
};
