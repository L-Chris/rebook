import { spawnSync } from 'node:child_process'

const maxPackageBytes = bytesArg('max-package-kb', 850 * 1024, 1024)
const maxUnpackedBytes = bytesArg('max-unpacked-kb', 3800 * 1024, 1024)
const requiredFiles = [
  'dist/index.js',
  'dist/core/fixed-document.js',
  'dist/core/renderer-router.js',
  'dist/renderers/browser.js',
  'miniprogram_dist/index.js',
  'package.json',
]
const forbiddenPrefixes = [
  'data/',
  'node_modules/',
  '.codegraph/',
  'src/',
  'tests/',
  'scripts/',
]

const pack = runPackDryRun()
const files = pack.files?.map((file) => file.path) ?? []
const fileSet = new Set(files)
const errors = []

for (const path of requiredFiles) {
  if (!fileSet.has(path)) errors.push(`missing required package file: ${path}`)
}

for (const path of files) {
  const forbidden = forbiddenPrefixes.find((prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix))
  if (forbidden) errors.push(`forbidden package file: ${path}`)
}

if (pack.size > maxPackageBytes) {
  errors.push(`package tarball size ${formatBytes(pack.size)} exceeds ${formatBytes(maxPackageBytes)}`)
}

if (pack.unpackedSize > maxUnpackedBytes) {
  errors.push(`package unpacked size ${formatBytes(pack.unpackedSize)} exceeds ${formatBytes(maxUnpackedBytes)}`)
}

console.log(`package files: ${files.length}`)
console.log(`package size: ${formatBytes(pack.size)} / ${formatBytes(maxPackageBytes)} ${pack.size <= maxPackageBytes ? 'OK' : 'OVER LIMIT'}`)
console.log(`unpacked size: ${formatBytes(pack.unpackedSize)} / ${formatBytes(maxUnpackedBytes)} ${pack.unpackedSize <= maxUnpackedBytes ? 'OK' : 'OVER LIMIT'}`)

if (errors.length > 0) {
  for (const error of errors) console.error(error)
  process.exitCode = 1
}

function runPackDryRun() {
  const child = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })
  const stdout = child.stdout ?? ''
  const output = `${stdout}\n${child.stderr ?? ''}`

  if (child.status !== 0) {
    throw new Error(`npm pack --dry-run failed with code ${child.status}\n${tail(output)}`)
  }

  const parsed = parseJsonArray(stdout)
  const first = parsed[0]
  if (!first || typeof first !== 'object') {
    throw new Error(`npm pack --dry-run returned invalid package metadata\n${tail(output)}`)
  }
  return first
}

function parseJsonArray(output) {
  for (let index = output.lastIndexOf('['); index >= 0; index = output.lastIndexOf('[', index - 1)) {
    const candidate = output.slice(index).trim()
    try {
      return JSON.parse(candidate)
    } catch {
      // Build logs can precede npm's JSON output. Keep scanning backward.
    }
  }
  throw new Error(`Unable to find npm pack JSON output\n${tail(output)}`)
}

function bytesArg(name, fallback, multiplier = 1) {
  const prefix = `--${name}=`
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
  const value = raw ? Number(raw) : fallback / multiplier
  return Number.isFinite(value) && value > 0 ? value * multiplier : fallback
}

function formatBytes(value) {
  return `${(value / 1024).toFixed(1)} KB`
}

function tail(value) {
  return value.split('\n').slice(-40).join('\n')
}
