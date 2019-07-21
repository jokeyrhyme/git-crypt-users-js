# git-crypt-users-js [![npm](https://img.shields.io/npm/v/git-crypt-users.svg?maxAge=2592000)](https://www.npmjs.com/package/git-crypt-users) [![Travis CI Status](https://travis-ci.org/jokeyrhyme/git-crypt-users-js.svg?branch=master)](https://travis-ci.org/jokeyrhyme/git-crypt-users-js) [![Greenkeeper badge](https://badges.greenkeeper.io/jokeyrhyme/git-crypt-users-js.svg)](https://greenkeeper.io/)

conveniently manage git-crypt users

## Requirements

- Node.js 10.x or newer
- git
- git-crypt
- gnupg 2.x or newer

## Installation

```sh
npm install --global git-crypt-users
```

## Usage

```sh
git-crypt-users-import
# loads git-crypt users' public keys into your GNUPG keyring

git-crypt-users-list
# loads git-crypt users' public keys into your GNUPG keyring

git-crypt-users-rotate
# generates a new key, re-encrypts encrypted files,
# and re-adds current git-crypt users

git-crypt-users-remove [userid...]
# generates a new key, re-encrypts encrypted files,
# and re-adds current git-crypt users, but does not re-add specified users
```
