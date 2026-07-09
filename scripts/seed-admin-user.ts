import { config as loadEnv } from "dotenv"
loadEnv({ path: ".env.local" })
loadEnv()

import { getDb } from "../lib/db/client"
import { user, userProfiles } from "../lib/db/schema"
import { eq } from "drizzle-orm"
import { auth } from "../lib/auth"

async function main() {
  const email = process.argv[2] || process.env.AUTH_FIRST_ADMIN_EMAIL
  if (!email) {
    console.error("Erro: E-mail nao especificado. Passe como argumento ou configure AUTH_FIRST_ADMIN_EMAIL.")
    console.error("Uso: pnpm exec tsx scripts/seed-admin-user.ts admin@example.com")
    process.exit(1)
  }

  const db = getDb()
  if (!db) {
    console.error("Erro: Conexao com o banco de dados falhou.")
    process.exit(1)
  }

  const sanitizedEmail = email.trim().toLowerCase()
  console.log(`Verificando usuario: ${sanitizedEmail}`)
  
  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, sanitizedEmail))
    .limit(1)

  let userId: string

  if (existingUser) {
    console.log(`Usuario existente encontrado com ID: ${existingUser.id}`)
    userId = existingUser.id
  } else {
    console.log(`Usuario nao encontrado. Criando novo usuario...`)
    
    let password = process.env.ADMIN_SEED_PASSWORD
    let isTempPassword = false
    if (!password) {
      const crypto = require("crypto")
      // Generate a secure temporary password (e.g. 16 hex chars plus complexity suffix)
      password = crypto.randomBytes(8).toString("hex") + "aA1!"
      isTempPassword = true
    }
    const name = "Admin"

    try {
      const result = await auth.api.signUpEmail({
        body: {
          email: sanitizedEmail,
          password,
          name,
        },
      })
      
      if (!result || !result.user) {
        throw new Error("Resposta de signUpEmail invalida.")
      }
      
      console.log(`Usuario criado com sucesso com ID: ${result.user.id}`)
      if (isTempPassword) {
        console.log(`\n==================================================`)
        console.log(`[AVISO] ADMIN_SEED_PASSWORD nao definida no ambiente.`)
        console.log(`SENHA TEMPORARIA GERADA: ${password}`)
        console.log(`Por favor, anote essa senha para fazer seu primeiro login.`)
        console.log(`==================================================\n`)
      }
      userId = result.user.id
    } catch (error) {
      console.error("Erro ao criar usuario via Better Auth:", error)
      process.exit(1)
    }
  }

  // Promote to admin
  console.log(`Promovendo usuario para a role 'admin'...`)
  await db
    .insert(userProfiles)
    .values({
      userId,
      role: "admin",
      displayName: existingUser ? existingUser.name : "Admin",
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        role: "admin",
        updatedAt: new Date(),
      },
    })

  console.log(`Usuario ${sanitizedEmail} promovido para 'admin' com sucesso!`)
}

main().catch((err) => {
  console.error("Erro no script seed-admin-user:", err)
  process.exit(1)
})
