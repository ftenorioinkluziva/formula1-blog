import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const stateDir = path.join(process.cwd(), ".cache", "playwright")
const statePath = path.join(stateDir, "webserver.json")

async function isAvailable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url)
    return response.status < 500
  } catch {
    return false
  }
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (await isAvailable(url)) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Timed out waiting for ${url}`)
}

async function globalSetup() {
  if (process.env.PLAYWRIGHT_SKIP_WEBSERVER) {
    return
  }

  const port = Number(process.env.PORT ?? 3000)
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`

  fs.mkdirSync(stateDir, { recursive: true })

  if (await isAvailable(baseURL)) {
    fs.writeFileSync(statePath, JSON.stringify({ reused: true }, null, 2))
    return
  }

  const stdout = fs.openSync(path.join(stateDir, "next.stdout.log"), "a")
  const stderr = fs.openSync(path.join(stateDir, "next.stderr.log"), "a")
  const child = spawn(process.execPath, [path.join("node_modules", "next", "dist", "bin", "next"), "dev"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", stdout, stderr],
    windowsHide: true,
  })

  fs.writeFileSync(statePath, JSON.stringify({ pid: child.pid, reused: false }, null, 2))

  child.unref()
  await waitForServer(baseURL, 120_000)
}

export default globalSetup
