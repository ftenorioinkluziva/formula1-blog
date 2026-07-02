import { asc, desc, eq, and } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { raceWeekends, raceSessions, sessionResults, drivers, teams } from "@/lib/db/schema"
import { GoogleGenerativeAI } from "@google/generative-ai"

export interface RaceData {
  weekendId: number
  season: number
  round: number
  grandPrixName: string
  circuit: string
  country: string
  results: RaceResult[]
  poleman: string | null
  fastestLapDriver: string | null
  fastestLapTime: string | null
  driverStandings: StandingEntry[]
  constructorStandings: StandingEntry[]
}

interface RaceResult {
  position: number
  driverName: string
  teamName: string
  gridPosition: number | null
  status: string
  points: number
  gapToLeader: string | null
  bestLapTime: string | null
  fastestLapRank: number | null
}

interface StandingEntry {
  position: number
  name: string
  points: number
}

export interface LastRaceInfo {
  weekendId: number
  season: number
  round: number
  grandPrixName: string
  circuit: string
  country: string
}

export async function getLastCompletedRace(season?: number, round?: number): Promise<LastRaceInfo | null> {
  const db = getDb()
  if (!db) return null

  if (season && round) {
    const weekend = await db
      .select()
      .from(raceWeekends)
      .where(and(eq(raceWeekends.season, season), eq(raceWeekends.round, round)))
      .limit(1)

    if (!weekend[0]) return null

    return {
      weekendId: weekend[0].id,
      season: weekend[0].season,
      round: weekend[0].round,
      grandPrixName: weekend[0].grandPrixName,
      circuit: weekend[0].circuit,
      country: weekend[0].country,
    }
  }

  const raceSession = await db
    .select({
      weekendId: raceSessions.weekendId,
      status: raceSessions.status,
    })
    .from(raceSessions)
    .where(eq(raceSessions.sessionCode, "R"))
    .orderBy(desc(raceSessions.id))
    .limit(20)

  const finalisedSession = raceSession.find((s) => s.status === "Finalised" || s.status === "finished")

  if (!finalisedSession) {
    const latest = raceSession[0]
    if (!latest) return null

    const weekend = await db
      .select()
      .from(raceWeekends)
      .where(eq(raceWeekends.id, latest.weekendId))
      .limit(1)

    if (!weekend[0]) return null

    return {
      weekendId: weekend[0].id,
      season: weekend[0].season,
      round: weekend[0].round,
      grandPrixName: weekend[0].grandPrixName,
      circuit: weekend[0].circuit,
      country: weekend[0].country,
    }
  }

  const weekend = await db
    .select()
    .from(raceWeekends)
    .where(eq(raceWeekends.id, finalisedSession.weekendId))
    .limit(1)

  if (!weekend[0]) return null

  return {
    weekendId: weekend[0].id,
    season: weekend[0].season,
    round: weekend[0].round,
    grandPrixName: weekend[0].grandPrixName,
    circuit: weekend[0].circuit,
    country: weekend[0].country,
  }
}

export async function getRaceDataForScript(weekendInfo: LastRaceInfo): Promise<RaceData | null> {
  const db = getDb()
  if (!db) return null

  const raceSess = await db
    .select()
    .from(raceSessions)
    .where(and(eq(raceSessions.weekendId, weekendInfo.weekendId), eq(raceSessions.sessionCode, "R")))
    .limit(1)

  if (!raceSess[0]) return null

  const raceSessionId = raceSess[0].id

  const results = await db
    .select({
      position: sessionResults.position,
      driverFullName: drivers.fullName,
      teamName: teams.name,
      gridPosition: sessionResults.gridPosition,
      status: sessionResults.status,
      points: sessionResults.points,
      gapToLeader: sessionResults.gapToLeader,
      bestLapTime: sessionResults.bestLapTime,
      fastestLapRank: sessionResults.fastestLapRank,
    })
    .from(sessionResults)
    .innerJoin(drivers, eq(sessionResults.driverId, drivers.id))
    .innerJoin(teams, eq(drivers.teamId, teams.id))
    .where(eq(sessionResults.sessionId, raceSessionId))
    .orderBy(asc(sessionResults.position))
    .limit(20)

  const qualiSess = await db
    .select()
    .from(raceSessions)
    .where(and(eq(raceSessions.weekendId, weekendInfo.weekendId), eq(raceSessions.sessionCode, "Q")))
    .limit(1)

  let poleman: string | null = null
  if (qualiSess[0]) {
    const pole = await db
      .select({ driverFullName: drivers.fullName })
      .from(sessionResults)
      .innerJoin(drivers, eq(sessionResults.driverId, drivers.id))
      .where(and(eq(sessionResults.sessionId, qualiSess[0].id), eq(sessionResults.position, 1)))
      .limit(1)

    poleman = pole[0]?.driverFullName ?? null
  }

  const fastestLapEntry = results.find((r) => r.fastestLapRank === 1)
  const fastestLapDriver = fastestLapEntry?.driverFullName ?? null
  const fastestLapTime = fastestLapEntry?.bestLapTime ?? null

  const allDrivers = await db
    .select({ fullName: drivers.fullName, points: drivers.points, position: drivers.position })
    .from(drivers)
    .orderBy(asc(drivers.position))
    .limit(5)

  const allTeams = await db
    .select({ name: teams.name, points: teams.points, position: teams.position })
    .from(teams)
    .orderBy(asc(teams.position))
    .limit(5)

  return {
    weekendId: weekendInfo.weekendId,
    season: weekendInfo.season,
    round: weekendInfo.round,
    grandPrixName: weekendInfo.grandPrixName,
    circuit: weekendInfo.circuit,
    country: weekendInfo.country,
    results: results.map((r) => ({
      position: r.position,
      driverName: r.driverFullName,
      teamName: r.teamName,
      gridPosition: r.gridPosition,
      status: r.status,
      points: r.points,
      gapToLeader: r.gapToLeader,
      bestLapTime: r.bestLapTime,
      fastestLapRank: r.fastestLapRank,
    })),
    poleman,
    fastestLapDriver,
    fastestLapTime,
    driverStandings: allDrivers.map((d) => ({
      position: d.position,
      name: d.fullName,
      points: d.points,
    })),
    constructorStandings: allTeams.map((t) => ({
      position: t.position,
      name: t.name,
      points: t.points,
    })),
  }
}

export async function generatePodcastScript(raceData: RaceData): Promise<string> {
  const genai = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
  const model = genai.getGenerativeModel({ model: "gemini-2.5-flash" })

  const top3 = raceData.results.slice(0, 3)
  const top10 = raceData.results.slice(0, 10)

  const podiumText = top3
    .map((r) => `${r.position}º ${r.driverName} (${r.teamName})`)
    .join(", ")

  const top10Text = top10
    .map((r) => {
      const grid = r.gridPosition ? ` - largou ${r.gridPosition}º` : ""
      const gap = r.gapToLeader ? ` (${r.gapToLeader} do líder)` : ""
      const dnf = r.status !== "finished" && r.status !== "Finished" ? ` [${r.status}]` : ""
      return `${r.position}º ${r.driverName}${grid}${gap}${dnf}`
    })
    .join("\n")

  const driverChampText = raceData.driverStandings
    .map((d) => `${d.position}º ${d.name} - ${d.points} pts`)
    .join(", ")

  const constructorChampText = raceData.constructorStandings
    .map((t) => `${t.position}º ${t.name} - ${t.points} pts`)
    .join(", ")

  const prompt = `Você é um apresentador de podcast de Fórmula 1 em português brasileiro, entusiasmado e bem-informado.
Crie um script de podcast de aproximadamente 700-800 palavras narrando os resultados do GP a seguir.
O podcast se chama "F1 Insight Podcast".

REGRA ABSOLUTA — FORMATO DE SAÍDA:
- Escreva EXCLUSIVAMENTE as palavras que o apresentador vai falar em voz alta.
- PROIBIDO incluir qualquer instrução de produção, indicação de trilha sonora, efeito sonoro, música de fundo, transição, stage direction, nota ao editor, marcador de seção, título, ou qualquer texto entre colchetes [] ou parênteses () que não seja parte da fala narrada.
- Exemplos do que NÃO deve aparecer: [Trilha sonora], [Música de abertura], [Efeito sonoro], (pausa), *música*, --- Seção ---, "Apresentador:", [Nome do host].
- O texto final deve ser um bloco contínuo de parágrafos que pode ser lido diretamente para gravação, sem nenhuma edição adicional.

DADOS DO GRANDE PRÊMIO:
- GP: ${raceData.grandPrixName} ${raceData.season} (Round ${raceData.round})
- Circuito: ${raceData.circuit}, ${raceData.country}
- Pole position: ${raceData.poleman ?? "Dados não disponíveis"}
- Volta mais rápida: ${raceData.fastestLapDriver ?? "N/A"}${raceData.fastestLapTime ? ` (${raceData.fastestLapTime})` : ""}

RESULTADO CORRIDA (Top 10):
${top10Text}

PÓDIO: ${podiumText}

CLASSIFICAÇÃO PILOTOS (Top 5):
${driverChampText}

CLASSIFICAÇÃO CONSTRUTORES (Top 5):
${constructorChampText}

ESTRUTURA NARRATIVA (apenas a voz, sem marcadores):
Abra com "Bem-vindos ao F1 Insight Podcast..." apresentando o GP. Narre a largada e primeiras voltas, os duelos e estratégias de pit stop, o resultado final e pódio com contexto, os destaques de pole e volta mais rápida, o impacto no campeonato, e encerre com agradecimento e call to action para o próximo GP.

DIRETRIZES DE ESTILO:
- Tom entusiasmado mas informativo
- Use os dados fornecidos fielmente
- Português brasileiro, linguagem acessível mas técnica quando necessário
- Narração contínua em parágrafos, sem títulos ou listas
- Ao mencionar o tempo de volta mais rápida, leia como por extenso: "1:32.456" → "um minuto, trinta e dois segundos e quatrocentos e cinquenta e seis milésimos"
- Se não houver dados suficientes para um ponto, adapte naturalmente sem inventar`

  const result = await model.generateContent(prompt)
  const raw = result.response.text() ?? ""
  return cleanPodcastScript(raw)
}

function cleanPodcastScript(script: string): string {
  return script
    .split("\n")
    .map((line) => line.replace(/\[[^\]]*\]/g, "").replace(/\*[^*]*\*/g, "").trim())
    .filter((line) => {
      if (line === "") return true
      const lower = line.toLowerCase()
      if (/^#{1,6}\s/.test(line)) return false
      if (/^[-—*_]{3,}$/.test(line)) return false
      if (/^(trilha|música|efeito|transição|pausa|apresentador:|host:|narrador:)/i.test(lower)) return false
      return true
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function estimateDuration(script: string): string {
  const wordCount = script.trim().split(/\s+/).length
  const minutes = Math.ceil(wordCount / 150)
  return `${minutes} min`
}
