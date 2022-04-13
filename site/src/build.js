const fs = require('fs')
const path = require('path')
const rollup = require('rollup')
const rollupPluginCommonJS = require('rollup-plugin-commonjs')
const rollupPluginJSON = require('rollup-plugin-json')
const rollupPluginNodeBuiltins = require('rollup-plugin-node-builtins')
const rollupPluginNodeResolve = require('rollup-plugin-node-resolve')
const rollupPluginTerser = require('rollup-plugin-terser')
const rollupPluginTypescript = require('rollup-plugin-typescript2')
const typescript = require('typescript')

const build = async (jsPath, frameworkName, script = true) => {
  let htmlContent = fs.readFileSync(path.join(__dirname, './index.html'), 'utf8')
  if (script) {
    htmlContent = htmlContent.replace('{framework}', `${frameworkName}.js`)
  } else {
    htmlContent = htmlContent.replace('{framework}', '')
  }
  fs.writeFileSync(path.join(__dirname, `../../../dist/eDesigners-${frameworkName}/index.html`), htmlContent)

  fs.copyFileSync(path.join(__dirname, './lib/fabric.min.js'), path.join(__dirname, `../../../dist/eDesigners-${frameworkName}/fabric.min.js`))

  const b = await rollup.rollup({
    input: jsPath,
    plugins: [
      rollupPluginJSON(),
      rollupPluginCommonJS(),
      rollupPluginNodeBuiltins(),
      rollupPluginNodeResolve(),
      rollupPluginTypescript({
        clean: true,
        typescript,
      }),
      rollupPluginTerser.terser({
        ecma: 8,
        toplevel: false,
        compress: {
          passes: 1,
        },
        mangle: {
          toplevel: false,
        },
      }),
    ],
    external: [
      'fabric/fabric-impl',
    ],
  })
  await b.write({
    format: 'iife',
    file: path.join(__dirname, `../../../dist/eDesigners-${frameworkName}/index.js`),
    globals: {
      'fabric/fabric-impl': 'fabric',
    },
    sourcemap: true,
  })
}
module.exports = build
