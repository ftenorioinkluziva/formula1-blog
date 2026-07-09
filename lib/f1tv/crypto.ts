import type CryptoType from "crypto"

const ALGORITHM = "aes-256-cbc"

function getKey(): Buffer {
  const crypto = require("crypto") as typeof CryptoType
  const secret = process.env.ADMIN_SECRET || "f1blog-admin-secret-key-2026-fallback"
  return crypto.createHash("sha256").update(secret).digest()
}

/**
 * Encrypts a plaintext password using AES-256-CBC with a derived key from ADMIN_SECRET.
 */
export function encryptPassword(text: string): string {
  const crypto = require("crypto") as typeof CryptoType
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  return `${iv.toString("hex")}:${encrypted}`
}

/**
 * Decrypts an encrypted password string.
 */
export function decryptPassword(encryptedText: string): string {
  const crypto = require("crypto") as typeof CryptoType
  const parts = encryptedText.split(":")
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted data format")
  }
  const iv = Buffer.from(parts[0], "hex")
  const encrypted = Buffer.from(parts[1], "hex")
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
  let decrypted = decipher.update(encrypted, undefined, "utf8")
  decrypted += decipher.final("utf8")
  return decrypted
}
