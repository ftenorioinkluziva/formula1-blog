import { getRedisClient } from "@/lib/cache/redis"
import {
  getSessionBannerPayload,
  type BannerSessionPayload,
} from "@/lib/db/session-banner"

const CACHE_KEY = "session-banner:v1"

function getBannerTtlSeconds(): number {
  const rawValue = process.env.REDIS_SESSION_BANNER_TTL_SECONDS
  const parsed = Number(rawValue)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 30
  }

  return Math.floor(parsed)
}

export async function getSessionBannerPayloadCached(): Promise<BannerSessionPayload | null> {
  const redis = await getRedisClient()

  if (!redis) {
    return getSessionBannerPayload()
  }

  try {
    const cachedValue = await redis.get(CACHE_KEY)

    if (cachedValue) {
      return JSON.parse(cachedValue) as BannerSessionPayload
    }
  } catch {
    return getSessionBannerPayload()
  }

  const banner = await getSessionBannerPayload()

  try {
    if (banner) {
      await redis.set(CACHE_KEY, JSON.stringify(banner), {
        EX: getBannerTtlSeconds(),
      })
    } else {
      await redis.del(CACHE_KEY)
    }
  } catch {
    return banner
  }

  return banner
}
