const path = require('path')
const build = require('../../build')

build(path.join(__dirname, './index.ts'), path.join(__dirname, '../../dist/orchestrator/index.js'), undefined, true)
