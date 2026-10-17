import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'))
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
if (!/^[a-z0-9-]+$/.test(manifest.id) || manifest.version !== packageJson.version) {
  throw new Error('Invalid plugin ID or mismatched package and manifest versions')
}

const build = spawnSync(process.execPath, ['esbuild.config.mjs', 'production'], {
  cwd: root,
  stdio: 'inherit',
})
if (build.status !== 0) process.exit(build.status ?? 1)

const dist = resolve(root, 'dist')
const destination = resolve(dist, manifest.id)
// Only the generated plugin directory may be replaced, never project sources.
if (dirname(destination) !== dist) throw new Error('Package path is outside dist')
await rm(destination, { recursive: true, force: true })
await mkdir(destination, { recursive: true })
for (const file of ['main.js', 'styles.css', 'manifest.json', 'README.md', 'README.zh-CN.md', 'LICENSE', 'UPSTREAM.json']) {
  await copyFile(resolve(root, file), resolve(destination, file))
}
await mkdir(resolve(destination, 'assets'), { recursive: true })
await copyFile(resolve(root, 'assets/logo.png'), resolve(destination, 'assets/logo.png'))
console.log(`Packaged ${manifest.name} ${manifest.version} in dist/${manifest.id}`)
