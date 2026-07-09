import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { redirect } from "@/lib/i18n/routing"
import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db/client"
import { userProfiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function getUserProfile(userId: string) {
  const db = getDb()
  if (!db) return null
  try {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1)
    return profile || null
  } catch (error) {
    console.error("Error fetching user profile:", error)
    return null
  }
}

export async function getCurrentSession() {
  try {
    const sessionData = await auth.api.getSession({
      headers: await headers(),
    })
    if (!sessionData) return null
    const profile = await getUserProfile(sessionData.user.id)
    return {
      session: sessionData.session,
      user: sessionData.user,
      profile,
    }
  } catch (error) {
    console.error("Error getting current session:", error)
    return null
  }
}

export function unauthorizedResponse() {
  return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  })
}

export function forbiddenResponse() {
  return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  })
}

export async function requireUser() {
  const session = await getCurrentSession()
  if (!session) {
    return unauthorizedResponse()
  }
  return session
}

export async function requireRole(role: string) {
  const session = await getCurrentSession()
  if (!session) {
    return unauthorizedResponse()
  }
  const userRole = session.profile?.role || "user"
  if (userRole !== role && userRole !== "admin") {
    return forbiddenResponse()
  }
  return session
}

export async function requireAnyRole(roles: string[]) {
  const session = await getCurrentSession()
  if (!session) {
    return unauthorizedResponse()
  }
  const userRole = session.profile?.role || "user"
  if (!roles.includes(userRole) && userRole !== "admin") {
    return forbiddenResponse()
  }
  return session
}

export async function requireAdmin() {
  const session = await getCurrentSession()
  if (!session) {
    return unauthorizedResponse()
  }
  const userRole = session.profile?.role || "user"
  if (userRole !== "admin") {
    return forbiddenResponse()
  }
  return session
}

// For Server Components (Pages)
export async function requireUserPage(locale: string) {
  const session = await getCurrentSession()
  if (!session) {
    redirect({ href: "/sign-in", locale })
    throw new Error("Redirecting...")
  }
  return session
}

export async function requireRolePage(locale: string, role: string) {
  const session = await getCurrentSession()
  if (!session) {
    redirect({ href: "/sign-in", locale })
    throw new Error("Redirecting...")
  }
  const userRole = session.profile?.role || "user"
  if (userRole !== role && userRole !== "admin") {
    redirect({ href: "/", locale })
    throw new Error("Redirecting...")
  }
  return session
}

export async function requireAnyRolePage(locale: string, roles: string[]) {
  const session = await getCurrentSession()
  if (!session) {
    redirect({ href: "/sign-in", locale })
    throw new Error("Redirecting...")
  }
  const userRole = session.profile?.role || "user"
  if (!roles.includes(userRole) && userRole !== "admin") {
    redirect({ href: "/", locale })
    throw new Error("Redirecting...")
  }
  return session
}

export async function requireAdminPage(locale: string) {
  const session = await getCurrentSession()
  if (!session) {
    redirect({ href: "/sign-in", locale })
    throw new Error("Redirecting...")
  }
  const userRole = session.profile?.role || "user"
  if (userRole !== "admin") {
    redirect({ href: "/", locale })
    throw new Error("Redirecting...")
  }
  return session
}
