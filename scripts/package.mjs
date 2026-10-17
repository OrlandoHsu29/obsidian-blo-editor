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
// Keep distributable archives beside the project, never in a personal vault.
const archive = resolve(root, `${packageJson.name}-${manifest.version}.zip`)
await rm(archive, { force: true })
const zip = process.platform === 'win32'
  ? spawnSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      'Compress-Archive -LiteralPath $env:BLO_PACKAGE_SOURCE -DestinationPath $env:BLO_PACKAGE_ARCHIVE -Force -ErrorAction Stop',
    ], {
      cwd: root,
      stdio: 'inherit',
      windowsHide: true,
      env: { ...process.env, BLO_PACKAGE_SOURCE: destination, BLO_PACKAGE_ARCHIVE: archive },
    })
  : spawnSync('zip', ['-q', '-r', archive, manifest.id], { cwd: dist, stdio: 'inherit' })
if (zip.error || zip.status !== 0) {
  await rm(archive, { force: true })
  throw zip.error ?? new Error('ZIP packaging failed; install zip on macOS/Linux')
}
console.log(`Packaged ${manifest.name} ${manifest.version}: ${archive}`)
