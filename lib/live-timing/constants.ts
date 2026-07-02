export const GQL_ENDPOINT = process.env.F1MV_API_URL ?? "http://localhost:10101/api/graphql"

export type LiveTimingSource = 'f1mv' | 'signalr'

export const LIVE_TIMING_SOURCE: LiveTimingSource =
  (process.env.LIVE_TIMING_SOURCE as LiveTimingSource) || 'signalr'

export const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#e10600",        // 🔴 Vermelho - Macio (melhor aderência, desgaste rápido)
  MEDIUM: "#ffd12e",      // 🟡 Amarelo - Médio (equilíbrio desempenho/durabilidade)
  HARD: "#e8e8e8",        // ⚪ Branco - Duro (maior resistência, menor aderência)
  INTERMEDIATE: "#43b02a", // 🟢 Verde - Intermediário (pista úmida/chuva leve)
  WET: "#0090d0",         // 🔵 Azul - Chuva intensa (evita aquaplanagem)
}

export const COMPOUND_SHORT: Record<string, string> = {
  SOFT: "S",
  MEDIUM: "M",
  HARD: "H",
  INTERMEDIATE: "I",
  WET: "W",
}

export const POLLING_INTERVAL = 200
