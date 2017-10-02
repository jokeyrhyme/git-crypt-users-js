// flow-typed signature: 684f23335fd1f8acb67c59f733e7115b

const fs = require('fs');

declare module 'fs' {
  declare module.exports : {
    /* flow 0.56.0 doesn't know about Node.js' built-in copyFile function */
    copyFile(src: string, dest: string, flags: number, callback: Function): void
  } & fs;
}
