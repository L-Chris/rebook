import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { strToU8, zipSync } from 'fflate'

const projectDir = resolve(import.meta.dirname, '..')
const manifestPath = resolve(projectDir, 'rebook-extension.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
if (manifest.manifestVersion !== 1 || !manifest.id || !manifest.version || !manifest.entry) {
  throw new Error('rebook-extension.json must define manifestVersion 1, id, version, and entry')
}

const entryPath = resolve(projectDir, manifest.entry)
if (!entryPath.startsWith(`${projectDir}/`)) throw new Error('manifest entry must stay inside the project')
const files = {
  'rebook-extension.json': strToU8(JSON.stringify(manifest, null, 2)),
  [manifest.entry]: new Uint8Array(await readFile(entryPath)),
}
for (const optional of ['README.md', 'CHANGELOG.md', 'LICENSE']) {
  try {
    files[optional] = new Uint8Array(await readFile(resolve(projectDir, optional)))
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

const outputPath = resolve(projectDir, 'package', `${manifest.id}-${manifest.version}.zip`)
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, zipSync(files, { level: 9 }))
console.log(`Created ${basename(outputPath)}`)
