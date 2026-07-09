import { execFile } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const statePath = path.join(process.cwd(), ".cache", "playwright", "webserver.json")

interface WebServerState {
  pid?: number
  reused?: boolean
}

async function globalTeardown() {
  if (!fs.existsSync(statePath)) {
    return
  }

  const state = JSON.parse(fs.readFileSync(statePath, "utf8")) as WebServerState
  fs.rmSync(statePath, { force: true })

  if (state.reused || !state.pid) {
    return
  }

  try {
    if (process.platform === "win32") {
      await execFileAsync("taskkill.exe", ["/PID", String(state.pid), "/T", "/F"])
    } else {
      process.kill(-state.pid, "SIGTERM")
    }
  } catch {
    // The process may already be gone after a failed or interrupted test run.
  }
}

export default globalTeardown
