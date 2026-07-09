import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/guards"
import { getDb } from "@/lib/db/client"
import { userProfiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { encryptPassword, decryptPassword } from "@/lib/f1tv/crypto"
import { loginWithF1TVCredentials } from "@/lib/f1tv/credentials-login"
import { activateAndPersistToken } from "@/lib/f1tv/token-persistence"
import { getRedisClient } from "@/lib/cache/redis"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  // 1. Verify user is admin
  const session = await requireAdmin()
  if (session instanceof Response) return session

  const userId = session.user.id

  // 2. Parse request body
  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { email, password } = body

  if (!email || email.trim() === "") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  const db = getDb()
  if (!db) {
    return NextResponse.json({ error: "Database not available" }, { status: 500 })
  }

  try {
    // 3. Fetch existing profile to check if a password already exists
    const [profile] = await db
      .select({
        f1tvPassword: userProfiles.f1tvPassword,
      })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1)

    let plainPassword = ""
    let shouldUpdatePassword = false

    if (password && password.trim() !== "") {
      plainPassword = password
      shouldUpdatePassword = true
    } else {
      // Password is empty, try to reuse existing one
      if (!profile || !profile.f1tvPassword) {
        return NextResponse.json({ error: "Password is required for first-time configuration" }, { status: 400 })
      }
      plainPassword = decryptPassword(profile.f1tvPassword)
    }

    // 4. Test login to Formula 1 API to validate the credentials
    console.log(`[f1tv/auth] Validating new F1TV credentials for ${email}...`)
    let loginResult: any = null
    let warningMessage: string | null = null

    try {
      loginResult = await loginWithF1TVCredentials(email, plainPassword)
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : String(err)
      const isWafBlock = errMsg.includes("403") || errMsg.includes("Pardon Our Interruption") || errMsg.includes("Forbidden")
      if (isWafBlock) {
        console.warn(`[f1tv/auth] WAF block detected during credentials validation: ${errMsg}`)
        
        const redis = await getRedisClient()
        if (redis) {
          await redis.set("f1tv:force-login-request", "true")
          warningMessage = "WAF block detected. Credentials were saved, and a background login request was sent to the Chromium worker. It should be authenticated in about 15 seconds."
        } else {
          warningMessage = "WAF block detected by Formula 1 servers. Credentials were saved, but Redis was unavailable to trigger the Chromium worker login."
        }
      } else {
        throw err
      }
    }

    // 5. Encrypt the password if we need to update it
    const encryptedPassword = shouldUpdatePassword 
      ? encryptPassword(plainPassword)
      : profile.f1tvPassword

    // 6. Update database profile
    await db
      .update(userProfiles)
      .set({
        f1tvEmail: email,
        f1tvPassword: encryptedPassword,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, userId))

    // 7. Instantly activate and persist the new token in Redis / memory (if successful)
    if (loginResult) {
      await activateAndPersistToken(loginResult.rawCookieValue)
    }

    return NextResponse.json({
      success: true,
      message: warningMessage || "Credentials successfully updated and session refreshed!",
      warning: !!warningMessage,
      expiresAt: loginResult ? loginResult.expiresAt.toISOString() : null,
    })
  } catch (error: any) {
    console.error("[f1tv/auth] Failed to update F1TV credentials:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Authentication check failed with F1TV servers" },
      { status: 400 }
    )
  }
}
