import { betterAuth } from "better-auth"
import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { getDb } from "@/lib/db/client"
import * as schema from "@/lib/db/schema"
import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"

let authInstance: any = null

function getAuthInstance() {
  if (!authInstance) {
    const db = getDb()
    if (!db) {
      // If we are during the build phase (or no database URL is set), we initialize betterAuth
      // with a dummy pool so it compiles without throwing errors.
      console.warn("Database connection could not be established in lib/auth.ts. Initializing with dummy database adapter.")
      const dummyPool = new Pool()
      const dummyDb = drizzle(dummyPool, { schema })
      authInstance = betterAuth({
        database: drizzleAdapter(dummyDb, {
          provider: "pg",
          schema,
        }),
        emailAndPassword: {
          enabled: true,
        },
      })
    } else {
      authInstance = betterAuth({
        database: drizzleAdapter(db, {
          provider: "pg",
          schema,
        }),
        emailAndPassword: {
          enabled: true,
        },
        databaseHooks: {
          user: {
            create: {
              after: async (user) => {
                const database = getDb()
                if (!database) return
                // Automatically set role to admin if it matches the first admin email env var
                const firstAdminEmail = process.env.AUTH_FIRST_ADMIN_EMAIL
                const role = firstAdminEmail && user.email.toLowerCase() === firstAdminEmail.toLowerCase() ? "admin" : "user"
                
                await database.insert(schema.userProfiles).values({
                  userId: user.id,
                  role: role,
                  displayName: user.name,
                }).onConflictDoUpdate({
                  target: schema.userProfiles.userId,
                  set: {
                    role: role,
                    displayName: user.name,
                    updatedAt: new Date()
                  }
                })
              },
            },
          },
        },
      })
    }
  }
  return authInstance
}

export const auth = new Proxy((() => {}) as any, {
  get(target, prop) {
    const instance = getAuthInstance()
    const value = Reflect.get(instance, prop)
    if (typeof value === "function") {
      return value.bind(instance)
    }
    return value
  },
  has(target, prop) {
    const instance = getAuthInstance()
    return Reflect.has(instance, prop)
  },
  apply(target, thisArg, argumentsList) {
    const instance = getAuthInstance()
    return Reflect.apply(instance, thisArg, argumentsList)
  }
})

