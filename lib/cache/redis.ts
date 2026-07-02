import { Redis } from "@upstash/redis"

// Upstash Redis client — HTTP-based, no persistent connections, serverless-safe
// Env vars: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// Set via Vercel Marketplace → Storage → Upstash Redis → Connect

declare global {
  var __f1BlogUpstashClient: Redis | undefined
}

function getUpstashClient(): Redis | null {
  // Support both standard names and the prefixed names Vercel Marketplace generates
  const url =
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.UPSTASH_REDIS_REST_URL_KV_REST_API_URL
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.UPSTASH_REDIS_REST_URL_KV_REST_API_TOKEN

  if (!url || !token) {
    return null
  }

  if (!globalThis.__f1BlogUpstashClient) {
    globalThis.__f1BlogUpstashClient = new Redis({ url, token })
  }

  return globalThis.__f1BlogUpstashClient
}

export interface AppRedisAdapter {
  get(key: string): Promise<string | null>
  set(key: string, value: string, options?: { EX?: number }): Promise<void>
  del(key: string): Promise<void>
}

export async function getRedisClient(): Promise<AppRedisAdapter | null> {
  const upstash = getUpstashClient()
  if (upstash) {
    return {
      async get(key) {
        const val = await upstash.get<string>(key)
        return val ?? null
      },
      async set(key, value, options) {
        if (options?.EX) {
          await upstash.set(key, value, { ex: options.EX })
        } else {
          await upstash.set(key, value)
        }
      },
      async del(key) {
        await upstash.del(key)
      },
    }
  }

  return null
}
