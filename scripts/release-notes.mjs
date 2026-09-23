// Release gate for .github/workflows/release.yml: given a tag like v0.2.0,
// fail unless package.json carries that version and CHANGELOG.md has a
// matching section, then print that section's body for the release notes.

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

function fail (msg) {
  console.error(`release-notes: ${msg}`)
  process.exit(1)
}

const tag = process.argv[2]
if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) fail(`expected a tag like v0.2.0, got ${tag || '(nothing)'}`)

const version = tag.slice(1)
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
if (pkg.version !== version) fail(`package.json is ${pkg.version}, tag is ${tag}`)

const lines = (await readFile(path.join(root, 'CHANGELOG.md'), 'utf8')).split('\n')
const start = lines.findIndex((l) => l === `## ${version}` || l.startsWith(`## ${version} `))
if (start === -1) fail(`CHANGELOG.md has no "## ${version}" section`)

let end = lines.length
for (let i = start + 1; i < lines.length; i++) {
  if (lines[i].startsWith('## ')) { end = i; break }
}

const body = lines.slice(start + 1, end).join('\n').trim()
if (!body) fail(`the "## ${version}" section in CHANGELOG.md is empty`)

process.stdout.write(body + '\n')
