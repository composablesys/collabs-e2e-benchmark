const fs = require('fs')
const path = require('path')
const build = require('../src/build')

build(path.join(__dirname, './index.ts'), 'owebsync')
fs.copyFileSync(path.join(__dirname, '../../../dist/owebsync.js'), path.join(__dirname, '../../../dist/eDesigners-owebsync/owebsync.js'))
fs.copyFileSync(path.join(__dirname, '../../../dist/owebsync.js.map'), path.join(__dirname, '../../../dist/eDesigners-owebsync/owebsync.js.map'))
fs.copyFileSync(path.join(__dirname, '../../../dist/owebsync-worker.js'), path.join(__dirname, '../../../dist/eDesigners-owebsync/owebsync-worker.js'))
fs.copyFileSync(path.join(__dirname, '../../../dist/owebsync-worker.js.map'), path.join(__dirname, '../../../dist/eDesigners-owebsync/owebsync-worker.js.map'))
