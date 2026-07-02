import { config as loadEnv } from "dotenv"

import { createTopicPendingArticle } from "./topic-article"

loadEnv({ path: ".env.local" })
loadEnv()

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const ALLOWED_CHAT_ID = String(process.env.TELEGRAM_CHAT_ID ?? "")
const POLL_TIMEOUT_S = 50
const MESSAGE_LIMIT = 3900

type TelegramMessage = {
  message_id: number
  text?: string
  chat: { id: number | string }
}

type TelegramUpdate = {
  update_id: number
  message?: TelegramMessage
}

type ParsedCommand = {
  name: string
  args: string[]
}

function ensureEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} não definido.`)
  }
  return value
}

function helpText(): string {
  return [
    "F1 Paddock Insider - Bot de Controle",
    "",
    "/topic <texto> - gera artigo por tema livre",
    "",
    "Atalhos",
    "/ajuda - esta mensagem",
    "/start - esta mensagem",
  ].join("\n")
}

function parseCommand(text: string): ParsedCommand | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith("/")) return null

  const match = trimmed.match(/^\/([a-zA-Z_]+)(?:@\w+)?(?:\s+([\s\S]+))?$/)
  if (!match) return null

  const [, name, argText] = match
  const args = argText ? argText.split(/\s+/).filter(Boolean) : []
  return { name: name.toLowerCase(), args }
}

function splitMessage(text: string): string[] {
  if (text.length <= MESSAGE_LIMIT) return [text]

  const parts: string[] = []
  let buffer = ""
  for (const line of text.split("\n")) {
    const candidate = buffer ? `${buffer}\n${line}` : line
    if (candidate.length > MESSAGE_LIMIT) {
      if (buffer) parts.push(buffer)
      buffer = line
      continue
    }
    buffer = candidate
  }

  if (buffer) parts.push(buffer)
  return parts.length > 0 ? parts : [text.slice(0, MESSAGE_LIMIT)]
}

async function telegramRequest(method: string, payload: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`https://api.telegram.org/bot${ensureEnv(BOT_TOKEN, "TELEGRAM_BOT_TOKEN")}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new Error(`Telegram API ${method} falhou: HTTP ${res.status}`)
  }

  const data = (await res.json()) as { ok: boolean; result?: unknown; description?: string }
  if (!data.ok) {
    throw new Error(data.description ?? `Telegram API ${method} retornou erro`)
  }

  return data.result
}

async function sendMessage(chatId: number | string, text: string): Promise<void> {
  for (const chunk of splitMessage(text)) {
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: chunk,
      disable_web_page_preview: true,
    })
  }
}

async function handleCommand(chatId: number | string, command: ParsedCommand): Promise<void> {
  switch (command.name) {
    case "start":
    case "ajuda":
      await sendMessage(chatId, helpText())
      return
    case "topic": {
      const topic = command.args.join(" ").trim()
      if (!topic) {
        await sendMessage(chatId, "Uso: /topic <tema>")
        return
      }
      await sendMessage(chatId, "Gerando artigo sobre: " + topic + "...")
      const saved = await createTopicPendingArticle(topic)
      await sendMessage(chatId, "Artigo salvo como pendência" + (saved.id ? " [ID " + saved.id + "]" : "") + ": " + saved.title)
      return
    }
    default:
      await sendMessage(chatId, helpText())
  }
}

async function pollUpdates(offset: number): Promise<TelegramUpdate[]> {
  const result = await telegramRequest("getUpdates", {
    offset,
    timeout: POLL_TIMEOUT_S,
    allowed_updates: ["message"],
  })

  return Array.isArray(result) ? (result as TelegramUpdate[]) : []
}

async function main(): Promise<void> {
  ensureEnv(BOT_TOKEN, "TELEGRAM_BOT_TOKEN")
  ensureEnv(ALLOWED_CHAT_ID, "TELEGRAM_CHAT_ID")

  console.log(`Bot iniciado. Chat autorizado: ${ALLOWED_CHAT_ID}`)

  let offset = 0
  for (;;) {
    try {
      const updates = await pollUpdates(offset)
      for (const update of updates) {
        offset = update.update_id + 1
        const message = update.message
        if (!message?.text) continue
        if (String(message.chat.id) !== ALLOWED_CHAT_ID) continue

        const command = parseCommand(message.text)
        if (!command) continue

        await handleCommand(message.chat.id, command)
      }
    } catch (error) {
      console.error("[tg-bot]", error instanceof Error ? error.message : String(error))
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
}

main().catch((error) => {
  console.error("[tg-bot]", error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
