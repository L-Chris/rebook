import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

loadEnvFile()

const token = process.env.NPM_TOKEN

if (!token) {
  console.error('NPM_TOKEN is required')
  process.exit(1)
}

const dir = mkdtempSync(join(tmpdir(), 'rebook-npm-'))
const userconfig = join(dir, '.npmrc')

try {
  writeFileSync(userconfig, `//registry.npmjs.org/:_authToken=${token}\n`, { mode: 0o600 })

  const result = spawnSync(
    'npm',
    ['publish', '--access', 'public', '--registry', 'https://registry.npmjs.org/'],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        NPM_CONFIG_USERCONFIG: userconfig,
      },
    },
  )

  process.exitCode = result.status ?? 1
} finally {
  rmSync(dir, { recursive: true, force: true })
}

function loadEnvFile() {
  if (!existsSync('.env')) return

  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex <= 0) continue

    const key = trimmed.slice(0, equalsIndex).trim()
    const value = trimmed.slice(equalsIndex + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}
