#!/usr/bin/env node
/**
 * Runs this project's containers, wherever Docker happens to live.
 *
 * Resolution order, deliberately:
 *   1. `docker` already on PATH — a normal install, CI, and anyone else
 *      cloning this repo. If it is there, nothing below runs.
 *   2. Known install locations for the current platform. Docker Desktop can be
 *      a per-user install that never touches PATH, which is the case on at
 *      least one machine this project is developed on.
 *
 * When Docker is found off-PATH, its folder is prepended to PATH *for the child
 * process only*. That matters: the credential helper and the compose plugin sit
 * next to docker.exe, and image pulls fail with
 * `docker-credential-desktop: executable file not found` without them.
 * Nothing outside this process is modified.
 *
 * Usage: node scripts/docker.mjs <prod|dev|stop|logs> [--open]
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { dirname, join } from 'node:path'

/** docker-compose.yml owns the ports; these are just the modes. */
const MODES = {
  prod: 'prod',
  dev: 'dev',
  stop: null,
  logs: null,
}

const args = process.argv.slice(2)
const mode = args.find((a) => !a.startsWith('-')) ?? 'prod'
const shouldOpen = args.includes('--open')

if (!(mode in MODES)) {
  console.error(`Unknown mode "${mode}". Use one of: ${Object.keys(MODES).join(', ')}`)
  process.exit(1)
}

const os = platform()
const exe = os === 'win32' ? 'docker.exe' : 'docker'

/** Candidate absolute paths to docker, most likely first. */
function candidates() {
  const home = homedir()
  if (os === 'win32') {
    const local = process.env.LOCALAPPDATA ?? join(home, 'AppData', 'Local')
    const pf = process.env.ProgramFiles ?? 'C:\\Program Files'
    const pf64 = process.env.ProgramW6432 ?? pf
    const pd = process.env.ProgramData ?? 'C:\\ProgramData'
    return [
      join(local, 'Programs', 'DockerDesktop', 'resources', 'bin', exe),
      join(pf, 'Docker', 'Docker', 'resources', 'bin', exe),
      join(pf64, 'Docker', 'Docker', 'resources', 'bin', exe),
      join(pd, 'DockerDesktop', 'version-bin', exe),
    ]
  }
  if (os === 'darwin') {
    return [
      '/usr/local/bin/docker',
      '/opt/homebrew/bin/docker',
      '/Applications/Docker.app/Contents/Resources/bin/docker',
      join(home, 'Applications', 'Docker.app', 'Contents', 'Resources', 'bin', 'docker'),
      join(home, '.docker', 'bin', 'docker'),
    ]
  }
  return ['/usr/bin/docker', '/usr/local/bin/docker', join(home, '.docker', 'bin', 'docker')]
}

/** The Docker Desktop application, so we can start a stopped engine. */
function desktopApp() {
  const home = homedir()
  if (os === 'win32') {
    const local = process.env.LOCALAPPDATA ?? join(home, 'AppData', 'Local')
    const pf = process.env.ProgramFiles ?? 'C:\\Program Files'
    return [
      join(local, 'Programs', 'DockerDesktop', 'Docker Desktop.exe'),
      join(pf, 'Docker', 'Docker', 'Docker Desktop.exe'),
    ].find(existsSync)
  }
  if (os === 'darwin') return existsSync('/Applications/Docker.app') ? '/Applications/Docker.app' : undefined
  return undefined
}

function onPath() {
  const probe = spawnSync(exe, ['--version'], { stdio: 'ignore', shell: false })
  return probe.status === 0
}

function resolveDocker() {
  if (onPath()) return { cmd: exe, dir: null, how: 'PATH' }
  const found = candidates().find(existsSync)
  if (found) return { cmd: found, dir: dirname(found), how: 'detected' }
  return null
}

const docker = resolveDocker()

if (!docker) {
  console.error(
    [
      '',
      'Could not find Docker.',
      '',
      '  Install Docker Desktop:  https://www.docker.com/products/docker-desktop/',
      '  Or, if it is installed somewhere unusual, put it on PATH and re-run.',
      '',
      `Looked on PATH, then at:`,
      ...candidates().map((c) => `  ${c}`),
      '',
    ].join('\n'),
  )
  process.exit(1)
}

// Child-process PATH only. Nothing outside this process changes.
const env = { ...process.env }
if (docker.dir) {
  env.PATH = docker.dir + (os === 'win32' ? ';' : ':') + (env.PATH ?? '')
  env.Path = env.PATH
}

const run = (args, opts = {}) =>
  spawnSync(docker.cmd, args, { env, stdio: 'inherit', shell: false, ...opts })

const quiet = (args) => spawnSync(docker.cmd, args, { env, stdio: 'ignore', shell: false }).status === 0

console.log(`docker: ${docker.how === 'PATH' ? 'on PATH' : docker.cmd}`)

/** Compose v2 is a docker plugin; fall back to the standalone v1 binary. */
const compose = quiet(['compose', 'version']) ? ['compose'] : null
if (!compose) {
  const legacy = spawnSync(os === 'win32' ? 'docker-compose.exe' : 'docker-compose', ['version'], {
    env,
    stdio: 'ignore',
  })
  if (legacy.status !== 0) {
    console.error('Docker is present but Compose is not. Install Compose, or update Docker Desktop.')
    process.exit(1)
  }
}

async function ensureEngine() {
  if (quiet(['info'])) return
  console.log('Docker engine is not responding.')

  const app = desktopApp()
  if (!app) {
    console.error('Start Docker (or the Docker daemon), then run this again.')
    process.exit(1)
  }

  console.log('Starting Docker Desktop — a cold start takes a minute or two.')
  if (os === 'darwin') spawnSync('open', ['-a', app], { stdio: 'ignore' })
  else spawn(app, [], { detached: true, stdio: 'ignore' }).unref()

  for (let i = 1; i <= 60; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    if (quiet(['info'])) return
    if (i % 5 === 0) console.log(`  waiting for the engine... [${i}/60]`)
  }
  console.error('Engine did not come up. Open Docker Desktop, wait for "Engine running", retry.')
  process.exit(1)
}

/**
 * The host port for a service, read from docker-compose.yml rather than
 * repeated here. Asking Compose to resolve its own config beats parsing YAML:
 * it handles any formatting, variable substitution and override files, and
 * needs no YAML dependency.
 */
function hostPort(service) {
  const out = spawnSync(docker.cmd, ['compose', 'config', '--format', 'json'], {
    env,
    encoding: 'utf8',
  })
  if (out.status === 0 && out.stdout) {
    try {
      // Compose emits a BOM on Windows.
      const text = out.stdout.charCodeAt(0) === 0xfeff ? out.stdout.slice(1) : out.stdout
      const published = JSON.parse(text)?.services?.[service]?.ports?.[0]?.published
      if (published) return Number(published)
    } catch {
      // fall through to the text scan
    }
  }
  return portFromYaml(service)
}

/** Last resort if `compose config --format json` is unavailable. */
function portFromYaml(service) {
  let text
  try {
    text = readFileSync('docker-compose.yml', 'utf8')
  } catch {
    return null
  }
  let current = null
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const indent = line.length - line.trimStart().length
    if (indent === 2 && trimmed.endsWith(':')) {
      current = trimmed.slice(0, -1)
      continue
    }
    if (current === service && trimmed.startsWith('- ')) {
      const mapping = trimmed.slice(2).trim().replace(/["']/g, '')
      const host = mapping.split(':')[0]
      if (host && !Number.isNaN(Number(host))) return Number(host)
    }
  }
  return null
}

function openBrowser(url) {
  if (os === 'win32') spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref()
  else if (os === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' }).unref()
  else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref()
}

await ensureEngine()

if (mode === 'stop') {
  process.exit(run(['compose', 'down']).status ?? 0)
}

if (mode === 'logs') {
  process.exit(run(['compose', 'logs', '-f']).status ?? 0)
}

const service = MODES[mode]
console.log()
console.log(`Building and starting "${service}". The first run pulls base images.`)
console.log()

const up = run(['compose', 'up', '-d', '--build', service])
if (up.status !== 0) process.exit(up.status ?? 1)

const port = hostPort(service)
const url = port ? `http://localhost:${port}` : null

// Better to say we do not know than to print a port compose no longer uses.
console.log()
console.log(url ? `  Running at ${url}` : '  Started. For the port: docker compose ps')
console.log('  Logs:  npm run docker:logs')
console.log('  Stop:  npm run docker:stop')
console.log()

if (shouldOpen && url) openBrowser(url)
