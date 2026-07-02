import { getRedisClient } from '@/lib/cache/redis'

const REDIS_KEY = 'f1tv:token'

export async function saveTokenToRedis(rawToken: string): Promise<boolean> {
  try {
    const redis = await getRedisClient()
    if (!redis) return false
    await redis.set(REDIS_KEY, rawToken)
    return true
  } catch {
    return false
  }
}

export async function loadTokenFromRedis(): Promise<string | null> {
  try {
    const redis = await getRedisClient()
    if (!redis) return null
    return await redis.get(REDIS_KEY)
  } catch {
    return null
  }
}

export async function deleteTokenFromRedis(): Promise<void> {
  try {
    const redis = await getRedisClient()
    if (!redis) return
    await redis.del(REDIS_KEY)
  } catch {
    // non-critical
  }
}
