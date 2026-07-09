import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  // baseURL can be empty or determined dynamically from the environment
  baseURL: process.env.NEXT_PUBLIC_APP_URL || undefined,
})
