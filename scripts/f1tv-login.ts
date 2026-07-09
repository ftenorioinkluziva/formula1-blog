import { config } from 'dotenv'
config({ path: '.env.local' })

import { readFileSync, writeFileSync } from 'fs'
import { chromium, type BrowserContext } from 'playwright'

const LOGIN_URL = 'https://account.formula1.com/#/en/login'
const POST_LOGIN_HOST = 'formula1.com'
const COOKIE_NAME = 'login-session'
const ENV_FILE = '.env.local'
const TIMEOUT_MS = 120_000

// Chrome 131 on Windows 11 — matches a real desktop browser fingerprint
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function extractSubscriptionToken(cookie: string): string | null {
  try {
    const decoded = decodeURIComponent(cookie)
    const parsed = JSON.parse(decoded)
    return parsed?.data?.subscriptionToken ?? null
  } catch {
    return null
  }
}

function decodeTokenPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  let payload = parts[1]
  const pad = payload.length % 4
  if (pad > 0) payload += '='.repeat(4 - pad)
  return JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'))
}

function saveTokenToEnv(token: string): void {
  let envContent = ''
  try {
    envContent = readFileSync(ENV_FILE, 'utf-8')
  } catch {
    // file doesn't exist yet
  }

  const lines = envContent.split('\n')
  const filtered = lines.filter((l) => !l.startsWith('F1TV_TOKEN='))
  filtered.push(`F1TV_TOKEN="${token}"`)

  writeFileSync(ENV_FILE, filtered.join('\n'))
}

function isTokenValid(rawCookie: string): boolean {
  const subToken = extractSubscriptionToken(rawCookie) ?? rawCookie
  const decoded = decodeTokenPayload(subToken)
  if (!decoded || typeof decoded.exp !== 'number') return false
  return new Date(decoded.exp * 1000) > new Date()
}

function waitForLoginCookie(context: BrowserContext): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      clearInterval(interval)
      reject(new Error(`Login timed out after ${TIMEOUT_MS / 1000}s`))
    }, TIMEOUT_MS)

    const interval = setInterval(async () => {
      const cookies = await context.cookies()
      const loginCookie = cookies.find(
        (c) => c.name === COOKIE_NAME && c.domain.includes(POST_LOGIN_HOST)
      )
      if (loginCookie) {
        clearTimeout(timer)
        clearInterval(interval)
        resolve(loginCookie.value)
      }
    }, 500)
  })
}

async function main(): Promise<void> {
  console.log('=== F1TV Login ===\n')

  const existingToken = process.env.F1TV_TOKEN
  if (existingToken && isTokenValid(existingToken)) {
    const subToken = extractSubscriptionToken(existingToken) ?? existingToken
    const decoded = decodeTokenPayload(subToken)!
    const expiresAt = new Date((decoded.exp as number) * 1000)
    console.log(`Existing token is still valid (expires ${expiresAt.toISOString()})`)
    console.log('To force re-login, remove F1TV_TOKEN from .env.local and run again.\n')
    process.exit(0)
  }

  const email = process.env.F1TV_EMAIL
  const password = process.env.F1TV_PASSWORD

  if (!email || !password) {
    console.error('F1TV_EMAIL and F1TV_PASSWORD must be set in .env.local')
    process.exit(1)
  }

  const isHeadless = process.env.HEADLESS === 'true' || process.argv.includes('--headless')
  console.log(`Logging in as ${email} (headless = ${isHeadless})...\n`)

  const browser = await chromium.launch({
    headless: isHeadless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-infobars',
      '--disable-setuid-sandbox',
    ],
  })

  const context = await browser.newContext({
    userAgent: USER_AGENT,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })

  const page = await context.newPage()

  try {
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' })

    // Try auto-fill — if selectors changed this will be a no-op and manual login still works
    try {
      await page.waitForSelector('input[name="Login"], input[type="email"]', { timeout: 5000 })
      const emailSelector = (await page.$('input[name="Login"]')) ? 'input[name="Login"]' : 'input[type="email"]'
      const passSelector = (await page.$('input[name="Password"]')) ? 'input[name="Password"]' : 'input[type="password"]'

      await page.fill(emailSelector, email)
      await page.waitForTimeout(300)
      await page.fill(passSelector, password)
      await page.waitForTimeout(300)
      await page.keyboard.press('Enter')

      console.log('Credentials filled — waiting for login to complete...')
    } catch {
      console.log('Auto-fill skipped — please log in manually in the browser window.')
    }

    console.log(`Waiting up to ${TIMEOUT_MS / 1000}s for login cookie...\n`)
    const cookieValue = await waitForLoginCookie(context)

    console.log('Cookie captured!')

    const subToken = extractSubscriptionToken(cookieValue)
    const finalToken = subToken ?? cookieValue

    const decoded = decodeTokenPayload(finalToken)
    if (!decoded) {
      console.error('Failed to decode token — invalid format.')
      process.exit(1)
    }

    const expiresAt = new Date((decoded.exp as number) * 1000)
    console.log(`  Name:    ${decoded.FirstName} ${decoded.LastName}`)
    console.log(`  Status:  ${decoded.SubscriptionStatus}`)
    console.log(`  Expires: ${expiresAt.toISOString()}`)

    if (expiresAt < new Date()) {
      console.error('\nToken is already expired. Try again.')
      process.exit(1)
    }

    saveTokenToEnv(cookieValue)
    console.log(`\nF1TV_TOKEN saved to ${ENV_FILE}`)
    
    try {
      const { saveTokenToRedis } = await import('../lib/f1tv/token-store')
      const savedRedis = await saveTokenToRedis(cookieValue)
      if (savedRedis) {
        console.log('F1TV_TOKEN successfully saved to Redis!')
      } else {
        console.warn('Failed to save F1TV_TOKEN to Redis (Redis might be offline/unreachable)')
      }
    } catch (err) {
      console.warn('Failed to save F1TV_TOKEN to Redis:', err)
    }
    
    console.log('Restart pnpm dev to apply the new token.')
  } finally {
    await browser.close()
  }
}

main()
