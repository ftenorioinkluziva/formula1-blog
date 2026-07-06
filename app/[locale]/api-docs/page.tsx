import type { JSX } from "react"

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="mb-16 scroll-mt-24">
    <h2 className="text-white text-3xl font-black uppercase tracking-tight mb-4 border-b border-gray-800 pb-2">
      {title}
    </h2>
    {children}
  </section>
)

const SubSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-6">
    <h3 className="text-white text-xl font-bold mb-3">{title}</h3>
    {children}
  </div>
)

const Code = ({ children }: { children: string }) => (
  <pre className="bg-black border border-gray-800 rounded-lg p-4 overflow-x-auto">
    <code className="text-sm text-gray-300 font-mono">{children}</code>
  </pre>
)

const Field = ({ name, type, desc, example }: { name: string; type: string; desc: string; example?: string }) => (
  <div className="border-l-2 border-red-500 pl-4 py-2 mb-3 bg-[#1a1a1a] rounded-r">
    <div className="flex items-baseline gap-2 mb-1">
      <code className="text-yellow-400 font-mono font-bold">{name}</code>
      <span className="text-gray-600">:</span>
      <code className="text-green-400 font-mono text-sm">{type}</code>
    </div>
    <p className="text-gray-400 text-sm">{desc}</p>
    {example && <code className="text-blue-400 text-xs block mt-1">Exemplo: {example}</code>}
  </div>
)

const Badge = ({ children, color = "gray" }: { children: React.ReactNode; color?: "red" | "green" | "blue" | "gray" }) => {
  const colors = {
    red: "bg-red-500/20 text-red-400 border-red-500/30",
    green: "bg-green-500/20 text-green-400 border-green-500/30",
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    gray: "bg-gray-800 text-gray-400 border-gray-700",
  }
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded border font-mono ${colors[color]}`}>
      {children}
    </span>
  )
}

const TOC = [
  { id: "overview", label: "Visão Geral" },
  { id: "connection", label: "Conexão" },
  { id: "snapshot", label: "Snapshot" },
  { id: "session", label: "Dados da Sessão" },
  { id: "drivers", label: "Pilotos & Timing" },
  { id: "weather", label: "Clima" },
  { id: "race-control", label: "Direção de Prova" },
  { id: "examples", label: "Exemplos Práticos" },
]

export default function ApiDocsPage(): JSX.Element {
  return (
    <main className="min-h-screen bg-[#0f0f0f] pt-20 pb-24">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-2">
            <Badge color="red">REST</Badge>
            <Badge color="green">SignalR</Badge>
            <Badge>Snapshot</Badge>
          </div>
          <h1 className="text-white text-4xl font-black uppercase tracking-tight mb-3">
            F1 Live Timing API
          </h1>
          <p className="text-gray-400 text-lg max-w-3xl">
            Documentação da API interna de Live Timing baseada em SignalR. Acesse snapshots normalizados do feed oficial da Fórmula 1.
          </p>
          <div className="mt-4 flex items-center gap-2 bg-[#1a1a1a] border border-gray-800 rounded-lg px-4 py-2 w-fit">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <code className="text-gray-400 text-sm font-mono">/[locale]/api/live-timing</code>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1">
            <nav className="sticky top-24 bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
              <h3 className="text-white font-bold mb-3 text-sm uppercase tracking-wide">Conteúdo</h3>
              <ul className="space-y-2">
                {TOC.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="text-gray-400 hover:text-red-500 text-sm transition-colors block"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <div className="lg:col-span-3">
            <Section id="overview" title="Visão Geral">
              <p className="text-gray-400 mb-4">
                A aplicação mantém uma conexão SignalR server-side com o Live Timing oficial da F1 e expõe snapshots normalizados pela API interna. 
                O navegador nunca acessa F1MV/MultiViewer nem endpoints locais externos.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
                  <div className="text-red-500 font-bold text-lg mb-1">SignalR</div>
                  <div className="text-gray-400 text-sm">Feed oficial normalizado</div>
                </div>
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
                  <div className="text-green-500 font-bold text-lg mb-1">Tempo Real</div>
                  <div className="text-gray-400 text-sm">Snapshot compartilhado no servidor</div>
                </div>
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
                  <div className="text-blue-500 font-bold text-lg mb-1">API interna</div>
                  <div className="text-gray-400 text-sm">Acesso pelo mesmo origin</div>
                </div>
              </div>
            </Section>

            <Section id="connection" title="Conexão">
              <SubSection title="Endpoint">
                <Code>{`GET /en/api/live-timing
Cache-Control: no-store`}</Code>
              </SubSection>

              <SubSection title="Exemplo Fetch (JavaScript)">
                <Code>{`const response = await fetch("/en/api/live-timing", {
  method: "GET",
  cache: "no-store"
})
const { data } = await response.json()
console.log(data.SessionInfo)`}</Code>
              </SubSection>

              <SubSection title="Exemplo cURL">
                <Code>{`curl -i http://localhost:3000/en/api/live-timing`}</Code>
              </SubSection>
            </Section>

            <Section id="snapshot" title="Snapshot Disponível">
              <Field name="data" type="F1LiveTimingRawState" desc="Estado normalizado do Live Timing retornado por /api/live-timing" />
              <Field name="meta" type="SnapshotMeta" desc="Identificador, horário de captura, resumo e indicador de snapshot stale" />
              <Field name="stats" type="SnapshotStoreStats" desc="Métricas do snapshot store, incluindo source=signalr e estado da ponte SignalR" />
            </Section>

            <Section id="session" title="Dados da Sessão">
              <p className="text-gray-400 mb-4">
                Campos disponíveis em <code className="text-yellow-400">data</code>:
              </p>

              <Field 
                name="SessionInfo" 
                type="JSONObject" 
                desc="Informações da sessão atual: GP, circuito, país, tipo (Practice/Qualifying/Race), datas"
                example='{ "Meeting": { "Name": "Monaco Grand Prix" }, "Type": "Race" }'
              />
              
              <Field 
                name="SessionStatus" 
                type="JSONObject" 
                desc="Status atual da sessão: Started | Finished | Aborted | Inactive"
                example='{ "Status": "Started" }'
              />
              
              <Field 
                name="TrackStatus" 
                type="JSONObject" 
                desc="Status da pista: AllClear | Yellow | Red | SCDeployed | VSCDeployed | VSCEnding"
                example='{ "Status": "1", "Message": "AllClear" }'
              />
              
              <Field 
                name="ExtrapolatedClock" 
                type="JSONObject" 
                desc="Tempo restante na sessão + flag se o relógio está extrapolando"
                example='{ "Remaining": "0:45:23", "Extrapolating": false }'
              />
              
              <Field 
                name="LapCount" 
                type="JSONObject" 
                desc="Volta atual e total de voltas (apenas em corridas)"
                example='{ "CurrentLap": 35, "TotalLaps": 78 }'
              />

              <SubSection title="Exemplo: Leitura de Sessão Completa">
                <Code>{`const response = await fetch("/en/api/live-timing", {
  method: "GET",
  cache: "no-store"
})
const { data } = await response.json()

const session = {
  info: data.SessionInfo,
  status: data.SessionStatus,
  track: data.TrackStatus,
  clock: data.ExtrapolatedClock,
  lapCount: data.LapCount,
}`}</Code>
              </SubSection>
            </Section>

            <Section id="drivers" title="Pilotos & Timing">
              <Field 
                name="DriverList" 
                type="JSONObject" 
                desc="Dados estáticos de todos os pilotos: nome completo, TLA, equipe, cor da equipe, foto"
                example='{ "4": { "FullName": "Lando Norris", "Tla": "NOR", "TeamName": "McLaren" } }'
              />
              
              <Field 
                name="TimingData" 
                type="JSONObject" 
                desc="Estado em tempo real: setores, gaps, última volta, status do pit"
                example='{ "4": { "Position": "1", "GapToLeader": "+0.000", "LastLapTime": "1:23.456" } }'
              />
              
              <Field 
                name="TimingAppData" 
                type="JSONObject" 
                desc="Dados de pneus: composto (SOFT/MEDIUM/HARD), novo/usado, voltas no stint"
                example='{ "4": { "Stints": { "0": { "Compound": "SOFT", "New": "true", "TotalLaps": 12 } } } }'
              />
              
              <Field 
                name="TimingStats" 
                type="JSONObject" 
                desc="Melhores valores da sessão: melhor volta, setores mais rápidos, top speeds"
                example='{ "Lines": { "4": { "BestLapTime": "1:22.345", "BestSectors": [25.1, 28.3, 28.9] } } }'
              />
              
              <Field 
                name="TopThree" 
                type="JSONObject" 
                desc="Top 3 formatado para exibição com diferenças de tempo"
                example='{ "Lines": [{ "RacingNumber": "4", "BestLapTime": "1:22.345" }] }'
              />

              <SubSection title="Estrutura DriverList">
                <Code>{`{
  "4": {
    "RacingNumber": "4",
    "FullName": "Lando Norris",
    "Tla": "NOR",
    "TeamName": "McLaren",
    "TeamColour": "FF8000",
    "HeadshotUrl": "https://...",
    "CountryCode": "GBR"
  }
}`}</Code>
              </SubSection>

              <SubSection title="Estrutura TimingData">
                <Code>{`{
  "4": {
    "Line": 1,
    "Position": "1",
    "GapToLeader": "+0.000",
    "IntervalToPositionAhead": { "Value": "+0.000" },
    "LastLapTime": { "Value": "1:23.456", "Status": 2048 },
    "Sectors": [
      { "Value": "25.123", "Status": 2048 },
      { "Value": "28.456" },
      { "Value": "29.789" }
    ],
    "InPit": false,
    "PitOut": false,
    "Stopped": false,
    "Retired": false
  }
}`}</Code>
              </SubSection>
            </Section>

            <Section id="weather" title="Clima">
              <Field 
                name="WeatherData" 
                type="JSONObject" 
                desc="Condições meteorológicas: temperatura do ar/pista, umidade, pressão, vento, chuva"
              />

              <SubSection title="Estrutura WeatherData">
                <Code>{`{
  "AirTemp": "24.5",
  "TrackTemp": "38.2",
  "Humidity": "65.3",
  "Pressure": "1013.2",
  "Rainfall": "0",
  "WindDirection": "180",
  "WindSpeed": "3.5"
}`}</Code>
              </SubSection>

              <SubSection title="Interpretação">
                <ul className="text-gray-400 space-y-2 ml-4">
                  <li>• <code className="text-yellow-400">AirTemp</code> / <code className="text-yellow-400">TrackTemp</code>: Celsius</li>
                  <li>• <code className="text-yellow-400">Humidity</code>: Percentual (0-100)</li>
                  <li>• <code className="text-yellow-400">Pressure</code>: mbar</li>
                  <li>• <code className="text-yellow-400">Rainfall</code>: 0 = sem chuva, 1 = chuva</li>
                  <li>• <code className="text-yellow-400">WindDirection</code>: Graus (0-359)</li>
                  <li>• <code className="text-yellow-400">WindSpeed</code>: m/s</li>
                </ul>
              </SubSection>
            </Section>

            <Section id="race-control" title="Direção de Prova">
              <Field 
                name="RaceControlMessages" 
                type="JSONObject" 
                desc="Mensagens da direção de prova: bandeiras, investigações, penalidades"
              />
              
              <Field 
                name="TeamRadio" 
                type="JSONObject" 
                desc="Transmissões de rádio das equipes (áudio MP3)"
              />

              <SubSection title="Estrutura RaceControlMessages">
                <Code>{`{
  "Messages": {
    "1": {
      "Utc": "2025-05-04T14:32:15.000Z",
      "Lap": 12,
      "Category": "Flag",
      "Message": "YELLOW TRACK",
      "Status": "YELLOW",
      "Flag": "YELLOW",
      "Scope": "Track",
      "Sector": 2,
      "RacingNumber": "4"
    }
  }
}`}</Code>
              </SubSection>

              <SubSection title="Categorias">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Badge>Flag</Badge>
                  <Badge>SafetyCar</Badge>
                  <Badge>Drs</Badge>
                  <Badge>CarEvent</Badge>
                </div>
              </SubSection>

              <SubSection title="Estrutura TeamRadio">
                <Code>{`{
  "Captures": {
    "1": {
      "Utc": "2025-05-04T14:30:22.000Z",
      "RacingNumber": "4",
      "Path": "TeamRadio/LANNOR01_4_20250504_143022.mp3"
    }
  }
}

// URL completa do áudio:
// https://livetiming.formula1.com/static/{SessionInfo.Path}/{capture.Path}`}</Code>
              </SubSection>
            </Section>

            <Section id="examples" title="Exemplos Práticos">
              <SubSection title="1. Dashboard de Sessão Completo">
                <Code>{`const response = await fetch("/en/api/live-timing", {
  method: "GET",
  cache: "no-store"
})
const { data } = await response.json()
const state = {
  sessionInfo: data.SessionInfo,
  sessionStatus: data.SessionStatus,
  trackStatus: data.TrackStatus,
  clock: data.ExtrapolatedClock,
  weather: data.WeatherData,
  drivers: data.DriverList,
  timing: data.TimingData,
  timingApp: data.TimingAppData,
  topThree: data.TopThree,
}`}</Code>
              </SubSection>

              <SubSection title="2. Polling com useEffect (React)">
                <Code>{`import { useEffect, useState } from "react"

export function useLiveTiming() {
  const [data, setData] = useState(null)
  
  useEffect(() => {
    const fetch = async () => {
      const res = await fetch("/en/api/live-timing", {
        method: "GET",
        cache: "no-store"
      })
      const json = await res.json()
      setData(json.data)
    }
    
    fetch() // Primeira chamada
    const interval = setInterval(fetch, 500) // Atualiza a cada 500ms
    return () => clearInterval(interval)
  }, [])
  
  return data
}`}</Code>
              </SubSection>

              <SubSection title="3. Calcular Gap entre Pilotos">
                <Code>{`function calculateGap(timingData, leaderNumber, driverNumber) {
  const leader = timingData[leaderNumber]
  const driver = timingData[driverNumber]
  
  const leaderMs = parseLapTime(leader.BestLapTime?.Value)
  const driverMs = parseLapTime(driver.BestLapTime?.Value)
  
  if (!leaderMs || !driverMs) return "—"
  
  const diffMs = driverMs - leaderMs
  return diffMs > 0 ? \`+\${(diffMs / 1000).toFixed(3)}\` : "0.000"
}

function parseLapTime(value) {
  if (!value) return null
  const [min, sec] = value.split(":")
  return (Number(min) * 60 + Number(sec)) * 1000
}`}</Code>
              </SubSection>

              <SubSection title="4. Monitorar Mensagens da Direção de Prova">
                <Code>{`function getLatestRaceMessages(raceControlMessages, limit = 5) {
  const messages = Object.values(
    raceControlMessages?.Messages || {}
  )
  
  return messages
    .sort((a, b) => new Date(b.Utc) - new Date(a.Utc))
    .slice(0, limit)
}

// Uso:
const recent = getLatestRaceMessages(state.RaceControlMessages, 5)
recent.forEach(msg => {
  console.log(\`[\${msg.Category}] \${msg.Message}\`)
})`}</Code>
              </SubSection>

              <SubSection title="5. Endpoints Internos Persistidos (PostgreSQL)">
                <Code>{`GET /{locale}/api/race-control-messages/{sessionId}
GET /{locale}/api/session-status-events/{sessionId}
GET /{locale}/api/lap-summaries/{sessionId}
GET /{locale}/api/session-analytics/{sessionId}
GET /{locale}/api/session-analytics/current`}</Code>
              </SubSection>

              <SubSection title="6. Exemplo: Resumo Agregado da Sessão Atual">
                <Code>{`const res = await fetch("/pt/api/session-analytics/current", {
  method: "GET",
  cache: "no-store"
})

const json = await res.json()
console.log(json.overview)
// {
//   latestStatus,
//   statusEvents,
//   raceControlMessages,
//   completedLaps,
//   latestRaceControlMessage
// }`}</Code>
              </SubSection>
            </Section>

            <div className="mt-12 p-6 bg-linear-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-lg">
              <h3 className="text-white font-bold mb-2">💡 Dicas de Performance</h3>
              <ul className="text-gray-400 space-y-2">
                <li>• Use polling de <strong className="text-white">500ms a 1s</strong> para atualizações em tempo real</li>
                <li>• Solicite apenas os campos necessários para reduzir payload</li>
                <li>• Cache <code className="text-yellow-400">DriverList</code> — muda raramente</li>
                <li>• <code className="text-yellow-400">Position</code> atualiza a cada frame (~100ms)</li>
                <li>• Use debounce para ações do usuário (seleção de piloto, filtros)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
