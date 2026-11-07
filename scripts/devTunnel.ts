/**
 * Dev-only Cloudflare quick tunnels for working outside the hospital LAN.
 *
 * Run this on a machine that stays inside the LAN. It exposes the API Gateway and
 * MinIO storage over https://*.trycloudflare.com so a laptop outside can point its
 * .env at them. URLs are random and change on every start.
 *
 *   npm run tunnel:start | tunnel:stop | tunnel:status
 *
 * Why PID files: this host also runs the production "Cloudflared agent" Windows
 * service, so we must never kill cloudflared.exe by image name — only our own PIDs.
 *
 * Security: quick-tunnel URLs are public. The only protection is the gateway
 * x-api-key and the S3 credentials, so stop the tunnels when not in use.
 */
import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

try {
  process.loadEnvFile('.env')
} catch {
  // .env is optional — variables may already be set in the shell
}

const STATE_DIR = path.join(process.cwd(), '.tunnel')
const URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/

const TUNNELS = [
  { name: 'gateway', envKey: 'API_GATEWAY_URL', origin: process.env.TUNNEL_GATEWAY_ORIGIN || process.env.API_GATEWAY_URL },
  { name: 'storage', envKey: 'S3_ENDPOINT', origin: process.env.TUNNEL_STORAGE_ORIGIN || process.env.S3_ENDPOINT },
]

type Tunnel = (typeof TUNNELS)[number]

const pidFile = (t: Tunnel) => path.join(STATE_DIR, `${t.name}.pid`)
const logFile = (t: Tunnel) => path.join(STATE_DIR, `${t.name}.log`)

function readPid(t: Tunnel): number | null {
  try {
    return Number(fs.readFileSync(pidFile(t), 'utf8').trim()) || null
  } catch {
    return null
  }
}

/** True only if the PID is alive AND is a cloudflared process (guards against PID reuse). */
function isRunning(t: Tunnel): boolean {
  const pid = readPid(t)
  if (!pid) return false
  const out = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: 'utf8' })
  return out.toLowerCase().includes('cloudflared.exe')
}

function readUrl(t: Tunnel): string | null {
  try {
    return fs.readFileSync(logFile(t), 'utf8').match(URL_PATTERN)?.[0] ?? null
  } catch {
    return null
  }
}

async function waitForUrl(t: Tunnel, timeoutMs = 30_000): Promise<string | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const url = readUrl(t)
    if (url) return url
    await new Promise((r) => setTimeout(r, 500))
  }
  return null
}

function printEnv() {
  console.log('\nใส่ใน .env ของเครื่องที่อยู่นอก รพ.:\n')
  for (const t of TUNNELS) {
    console.log(`${t.envKey}="${isRunning(t) ? readUrl(t) ?? '(ยังไม่ได้ URL)' : '(ไม่ได้รัน)'}"`)
  }
  console.log()
}

async function start() {
  fs.mkdirSync(STATE_DIR, { recursive: true })
  for (const t of TUNNELS) {
    if (!t.origin) throw new Error(`ไม่พบ origin ของ ${t.name} — ตั้ง ${t.envKey} ใน .env`)
    if (t.origin.includes('trycloudflare.com')) {
      throw new Error(`${t.envKey} ชี้ไปที่ tunnel อยู่แล้ว — เครื่องนี้ต้องใช้ IP ภายใน LAN`)
    }
    if (isRunning(t)) {
      console.log(`[${t.name}] รันอยู่แล้ว (PID ${readPid(t)})`)
      continue
    }
    const out = fs.openSync(logFile(t), 'w')
    const child = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', t.origin], {
      detached: true,
      stdio: ['ignore', out, out],
      windowsHide: true,
    })
    child.unref()
    fs.writeFileSync(pidFile(t), String(child.pid))
    console.log(`[${t.name}] เริ่ม tunnel → ${t.origin} (PID ${child.pid})`)
  }
  for (const t of TUNNELS) {
    if (!(await waitForUrl(t))) console.warn(`[${t.name}] ไม่ได้ URL ภายใน 30 วินาที — ดู ${logFile(t)}`)
  }
  printEnv()
}

function stop() {
  for (const t of TUNNELS) {
    const pid = readPid(t)
    if (pid && isRunning(t)) {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
      console.log(`[${t.name}] ปิดแล้ว (PID ${pid})`)
    } else {
      console.log(`[${t.name}] ไม่ได้รันอยู่`)
    }
    fs.rmSync(pidFile(t), { force: true })
  }
}

const command = process.argv[2]
if (command === 'start') {
  start().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
} else if (command === 'stop') {
  stop()
} else if (command === 'status') {
  for (const t of TUNNELS) console.log(`[${t.name}] ${isRunning(t) ? `รันอยู่ (PID ${readPid(t)})` : 'ไม่ได้รัน'}`)
  printEnv()
} else {
  console.log('usage: tsx scripts/devTunnel.ts <start|stop|status>')
  process.exit(1)
}
