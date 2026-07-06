import { Redis } from "@upstash/redis"
import { createClient } from "redis"

// Redis client.
// - Upstash REST: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// - Redis TCP: REDIS_URL, e.g. redis://default:password@host:port

declare global {
  var __f1BlogUpstashClient: Redis | undefined
  var __f1BlogRedisClient: Promise<ReturnType<typeof createClient>> | undefined
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

async function getTcpRedisClient(): Promise<ReturnType<typeof createClient> | null> {
  const url = process.env.REDIS_URL
  if (!url) {
    return null
  }

  if (!globalThis.__f1BlogRedisClient) {
    const client = createClient({ url })
    client.on("error", (err) => {
      console.warn("[redis] TCP client error:", err instanceof Error ? err.message : err)
    })
    globalThis.__f1BlogRedisClient = client.connect().then(() => client)
  }

  return await globalThis.__f1BlogRedisClient
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

  const tcp = await getTcpRedisClient()
  if (tcp) {
    return {
      async get(key) {
        return await tcp.get(key)
      },
      async set(key, value, options) {
        if (options?.EX) {
          await tcp.set(key, value, { EX: options.EX })
        } else {
          await tcp.set(key, value)
        }
      },
      async del(key) {
        await tcp.del(key)
      },
    }
  }

  return null
}
