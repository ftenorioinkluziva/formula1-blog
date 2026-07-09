import { defineConfig, devices } from "@playwright/test"

// Disable background instrumentation workers and token loaders during E2E tests to avoid hanging teardowns
process.env.INSTRUMENTATION_ENABLED = "0"
process.env.F1TV_AUTO_RENEW_ENABLED = "0"
process.env.AUTO_CONNECT_ENABLED = "0"
process.env.AUTO_POST_ROUND_ENABLED = "0"

const port = Number(process.env.PORT ?? 3000)
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`

process.env.BETTER_AUTH_URL = baseURL
const defaultPlaywrightDatabaseUrl =
  "postgresql://f1blog_user:vA29HAUabVbIVs15OpqhAVXKNvaDqk7B@localhost:5432/f1blog?sslmode=disable"
const inheritedDatabaseUrl = process.env.DATABASE_URL
process.env.DATABASE_URL =
  process.env.PLAYWRIGHT_DATABASE_URL ??
  (inheritedDatabaseUrl?.includes("@postgres:") ? defaultPlaywrightDatabaseUrl : inheritedDatabaseUrl) ??
  defaultPlaywrightDatabaseUrl
process.env.REDIS_URL = process.env.PLAYWRIGHT_REDIS_URL ?? ""

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: false,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
})
