import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js"

export async function convertScriptToAudio(script: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "pNInz6obpgDQGcFmaJgB"

  if (!apiKey) throw new Error("ELEVENLABS_API_KEY não configurado")

  const client = new ElevenLabsClient({ apiKey })

  const audioStream = await client.textToSpeech.convert(voiceId, {
    text: script,
    modelId: "eleven_multilingual_v2",
    outputFormat: "mp3_44100_128",
    voiceSettings: {
      stability: 0.5,
      similarityBoost: 0.75,
    },
  })

  const reader = audioStream.getReader()
  const chunks: Uint8Array[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }

  return Buffer.concat(chunks)
}
