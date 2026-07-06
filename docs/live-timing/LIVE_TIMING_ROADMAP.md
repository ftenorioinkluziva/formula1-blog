# Live Timing — Roadmap & Arquitetura

> Última atualização: 2026-02-28 (SignalR local + endpoint configurável via env var)

---

## 🏗️ Visão Geral do Projeto

**v0 Formula 1 Blog** — Aplicação Next.js com foco em conteúdo e live timing de Fórmula 1.

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| Banco de dados | PostgreSQL + Drizzle ORM |
| Cache | Redis |
| UI | Shadcn UI + Radix + Tailwind CSS v4 + Recharts |
| i18n | next-intl (en / pt / es) |
| Live Timing | SignalR (`SIGNALR_HUB_URL` → Snapshot Store → API interna) |
| Observabilidade | NDJSON file log + relatório automático pós-sessão |

---

## 📊 Cobertura da API — Estado Atual

### `f1LiveTimingState` — 27 campos mapeados

| Campo | Dados | Status | Componente(s) | Onde |
|---|---|---|---|---|
| `DriverList` | Nome, equipe, cor, TLA, foto | ✅ Completo | Todas as timing tables | Dashboards |
| `TimingData` | Posição, gap, volta, status, pit | ✅ Completo | Race/Practice/QualifyingTimingTable | Dashboards |
| `TimingData.Sectors[].Value` | Tempo S1/S2/S3 | ✅ Completo | SectorComparison | Dashboards |
| `TimingData.Speeds.ST` | Speed trap (1 ponto) | ✅ Completo | SpeedTrapComparison | Dashboards |
| `TimingData.Speeds.I1/I2/FL/ST` | 4 pontos de velocidade | ✅ Completo | `SpeedTrapsTable` | /unused |
| `TimingData.Sectors[].Segments` | Mini-setores por status | ✅ Completo | `MiniSectorGrid` | /unused |
| `TimingAppData` | Stints, compostos, voltas/pneu | ✅ Completo | TireStrategyChart, PitStopTimeline | Dashboards |
| `TimingStats` | Melhores setores/velocidades | ✅ Completo | TimingStatsCard, SectorComparison | Dashboards |
| `WeatherData` | Snapshot climático atual | ✅ Completo | WeatherWidget | Dashboards |
| `WeatherDataSeries` | Histórico 54+ pontos climáticos | ✅ Completo | `WeatherHistoryChart` | /unused |
| `SessionInfo` | Nome, circuito, país, tipo, datas | ✅ Completo | RaceHeaderBar | Dashboards |
| `SessionStatus` | Status (Started/Ended/Aborted…) | ✅ Completo | RaceHeaderBar, TrackMapLive | Dashboards |
| `ExtrapolatedClock` | Tempo restante / extrapolando | ✅ Completo | RaceHeaderBar | Dashboards |
| `TrackStatus` | Pista livre/amarelo/vermelho/SC | ✅ Completo | TrackStatusBanner | Dashboards |
| `RaceControlMessages` | Mensagens oficiais com flags | ✅ Completo | RaceControlFeed | Dashboards |
| `TeamRadio` | Clips de rádio + transcrição IA | ✅ Completo | TeamRadioList | Dashboards |
| `TopThree` | Pódio ao vivo | ✅ Completo | PodiumWidget | /unused |
| `LapCount` | Volta atual / total | ✅ Completo | LapCounter, RaceHeaderBar | Dashboards |
| `LapSeries` | Posição histórica por volta | ✅ Completo | `LapPositionChart` | /unused |
| `PitLaneTimeCollection` | Duração de pit stops | ⚠️ Parcial | — *(componente removido no cleanup)* | — |
| `ChampionshipPrediction` | Previsão de pontos (corridas ao vivo) | ✅ Completo | `ChampionshipPredictionCard`, `ChampionshipPredictionCompact` | /unused + Home |
| `ContentStreams` + `AudioStreams` | Streams de comentário/áudio | ✅ Completo | `ContentStreamsPanel` | /unused |
| `SessionData` | Timeline de status + partes da quali | ⚠️ Parcial | — *(componente removido no cleanup)* | — |
| `TimingData.GapToLeader/IntervalToPositionAhead` | Traço de gaps vs líder (amostrado) | ✅ Completo | `RaceTraceChart` | /unused |
| `CarData` | RPM, velocidade, marcha, acelerador, freio, DRS | 🚫 Removido | Dado não utilizado — removido do sistema em Fev/2026 | — |
| `Position` (X/Y/Z) | Coordenadas 3D de todos os carros | ✅ Completo | `TrackMapLive` — SVG animado com smoothing | /unused |
| `ArchiveStatus` | Estado do arquivo da sessão | ❌ Não | — | — |
| `Heartbeat` | Sinal de saúde do servidor | ❌ Não | — | — |

**Cobertura ativa: 22/26 (85%) — CarData removido intencionalmente**

---

## 🗂️ Componentes — Inventário Completo

### Componentes nas páginas principais (Dashboards)

| Componente | Campo(s) API | Race | Quali | Practice |
|---|---|:---:|:---:|:---:|
| `LiveTimingProvider` | Todos | ✅ | ✅ | ✅ |
| `SessionSidebarHeader` | `SessionInfo`, `LapCount` | ✅ | ✅ | ✅ |
| `TrackStatusBanner` | `TrackStatus` | ✅ | ✅ | ✅ |
| `WeatherWidget` | `WeatherData` | ✅ | ✅ | ✅ |
| `RaceControlFeed` | `RaceControlMessages` | ✅ | ✅ | ✅ |
| `RaceTimingTable` | `TimingData`, `DriverList`, `TimingAppData` | ✅ | — | — |
| `QualifyingTimingTable` | `TimingData`, `DriverList`, `TimingStats` | — | ✅ | — |
| `PracticeTimingTable` | `TimingData`, `DriverList`, `TimingStats` | — | — | ✅ |
| `TimingStatsCard` | `TimingStats` | — | ✅ | — |
| `RaceHeaderBar` | `SessionInfo`, `WeatherData`, `LapCount` | — | ✅ | ✅ |

**Funcionalidades especiais dos dashboards:**
- `QualifyingDashboard`: coluna **Theoretical Best Lap** (soma dos melhores setores por piloto)
- `TimingTable`: expansão por piloto para histórico de voltas inline

### Componentes em /unused (validação)

| Componente | Campo(s) API | Dados reais | Notas |
|---|---|:---:|---|
| `TrackMapLive` | `Position.{X,Y,Z}` | ✅ | SVG animado, smoothing por buffer, painel de debug `?trackDebug=1`, exibe último status de sessão |
| `RaceHeaderBar` | `SessionInfo`, `WeatherData` | ✅ | — |
| `PodiumWidget` | `TopThree` | ✅ | — |
| `SectorComparison` | `TimingStats.BestSectors` | ✅ | — |
| `SpeedTrapComparison` | `TimingStats.BestSpeeds` | ✅ | — |
| `PositionEvolutionChart` | `TimingData` | ✅ | Tooltip com nome do piloto ao hover |
| `TireStrategyChart` | `TimingAppData.Stints` | ✅ | — |
| `LapPositionChart` | `LapSeries` | ✅ | Tooltip com nome do piloto ao hover |
| `WeatherHistoryChart` | `WeatherDataSeries` | ✅ | — |
| `MiniSectorGrid` | `TimingData.Sectors[].Segments` | ✅ | Cores corrigidas (Roxo/Amarelo), 2 linhas/piloto (atual + melhor volta), ordenado por posição |
| `SpeedTrapsTable` | `TimingData.Speeds I1/I2/FL/ST` | ✅ | — |
| `ChampionshipPredictionCard` | `ChampionshipPrediction` | ⚠️ | Null fora de corridas |
| `ContentStreamsPanel` | `ContentStreams`, `AudioStreams` | ✅ | 1 stream Commentary ativo |
| `RaceTraceChart` | `TimingData` (gap/intervalo + lap) | ✅ | Filtros Top5/10/15/Todos/Até +20s, tooltip com nome do piloto |

### Componentes na Homepage (`app/[locale]/page.tsx`)

| Componente | Fonte de dados | Endpoint interno | Status |
|---|---|---|---|
| `Navigation` | Config local | — | Local por design |
| `SessionBanner` | API interna | `GET /[locale]/api/session-banner` | DB/API + Redis |
| `ChampionshipPredictionCompact` | Live timing | `GET /[locale]/api/live-timing` | Visível só durante corrida ao vivo |
| `HeroSection` | Notícias + pilotos | `GET /[locale]/api/news`, `GET /[locale]/api/drivers` | DB/API |
| `StandingsTicker` | Pilotos | `GET /[locale]/api/drivers` | DB/API |
| `TeamProfiles` | Equipes | `GET /[locale]/api/teams` | DB/API |
| `DriverProfiles` | Pilotos | `GET /[locale]/api/drivers` | DB/API |
| `NewsSection` | Notícias | `GET /[locale]/api/news` | DB/API |
| `MultimediaSection` | Mídia | `GET /[locale]/api/multimedia` | DB/API |
| `StandingsSection` | Pilotos + equipes | `GET /[locale]/api/drivers`, `GET /[locale]/api/teams` | DB/API |
| `ScheduleSection` | Calendário/sessões | `GET /[locale]/api/race-weekends` | DB/API |
| `SiteFooter` | Config local | — | Local por design |

---

## 🔄 Fluxo de Dados

```
SignalR (process.env.SIGNALR_HUB_URL ?? "https://livetiming.formula1.com/signalrcore")
    ↓
Snapshot Store (servidor, TTL adaptativo + dedupe in-flight)
    ↓
API interna /[locale]/api/live-timing
  ├── ?mode=latest    → último snapshot com meta + stats
  ├── ?mode=history   → histórico resumido (N entradas)
  ├── ?mode=stats     → métricas do store
  └── ?mode=dashboard → sessão agregada (endpoint centralizado)
    ↓
fetchLiveTiming() (cliente com dedupe + microcache)
    ↓
Raw F1LiveTimingRawState
    ↓  parsers.ts — 20+ funções de transformação
LiveTimingState (normalizado, tipado)
    ↓  LiveTimingContext
useLiveTiming() hook + componentes especializados

Observabilidade:
- logs/live-timing.ndjson (snapshot_fetched, snapshot_fetch_failed, cache_hit, inflight_join)
- pnpm analyze:live-log → logs/live-timing-report.latest.{md,json}
```

**Intervalos de polling:**

| Dado | Intervalo |
|---|---|
| Timing principal | 500ms (race/quali) / 1000ms (practice) |
| Setores + velocidades | 2000ms |
| Stints / estratégia | 5000ms |
| Clima histórico | 10000ms |
| Streams | 15000ms |

**TTL adaptativo do Snapshot Store:**

| Status de sessão | TTL |
|---|---|
| `Started` (ao vivo) | 500ms |
| `Finished` / `Ends` / `Inactive` | 5000ms |

---

## 🏗️ Arquitetura de Pastas

```
components/live-timing/
├── LiveTimingProvider.tsx        # Context + polling centralizado
├── index.ts                      # Barrel exports
│
├── analysis/
│   ├── TimingStatsCard.tsx
│   ├── SectorComparison.tsx
│   ├── SpeedTrapComparison.tsx
│   ├── LapPositionChart.tsx      # LapSeries — tooltip com nome do piloto
│   ├── WeatherHistoryChart.tsx   # WeatherDataSeries
│   ├── MiniSectorGrid.tsx        # Segments — 2 linhas, cores corretas, por posição
│   ├── SpeedTrapsTable.tsx       # Speeds I1/I2/FL/ST
│   ├── ChampionshipPredictionCard.tsx   # ChampionshipPrediction
│   ├── ContentStreamsPanel.tsx   # ContentStreams + AudioStreams
│   └── RaceTraceChart.tsx        # Gap vs líder por amostra — tooltip com nome
│
├── dashboards/
│   ├── RaceDashboard.tsx
│   ├── QualifyingDashboard.tsx   # Inclui Theoretical Best Lap
│   ├── PracticeDashboard.tsx
│   └── LiveTimingDashboard.tsx
│
├── race-control/
│   └── RaceControlFeed.tsx
│
├── radio/
│   └── TeamRadioList.tsx
│
├── session/
│   ├── RaceHeaderBar.tsx
│   ├── SessionSidebarHeader.tsx
│   ├── LapCounter.tsx
│   ├── TrackStatusBanner.tsx
│   ├── PodiumWidget.tsx
│   └── ConnectionStatus.tsx
│
├── strategy/
│   ├── TireStrategyChart.tsx
│   └── PitStopTimeline.tsx
│
├── timing/
│   ├── TimingTable.tsx           # Suporte a expansão por piloto (lap history)
│   ├── RaceTimingTable.tsx
│   ├── QualifyingTimingTable.tsx
│   └── PracticeTimingTable.tsx
│
├── track/
│   ├── PositionEvolutionChart.tsx
│   └── TrackMapLive.tsx          # Position X/Y/Z — exibe último status de sessão
│
└── weather/
    └── WeatherWidget.tsx

lib/live-timing/
├── api.ts          # fetchLiveTiming() — rota interna + dedupe/microcache
├── types.ts        # Todas as interfaces TypeScript
├── parsers.ts      # 20+ funções de parse (raw → normalizado)
├── formatters.ts   # formatGap(), parseLapTimeToMs()
├── constants.ts    # COMPOUND_COLORS, POLLING_INTERVAL
└── persistence/
    ├── live-timing-snapshot-store.ts   # Snapshot store (TTL adaptativo + dedupe + métricas)
    └── live-timing-file-log.ts         # Log NDJSON com rotação (5MB)

app/[locale]/api/
├── live-timing/route.ts   # latest / history / stats / dashboard
├── session-banner/        # Banner Redis + PostgreSQL fallback
├── drivers/               # Pilotos
├── teams/                 # Equipes
├── race-weekends/         # Calendário + sessões
├── news/                  # Notícias
└── multimedia/            # Vídeos, galerias, podcasts

app/[locale]/live-timing/
├── page.tsx                # → LiveTimingDashboard
├── race/page.tsx           # → RaceDashboard
├── qualifying/page.tsx     # → QualifyingDashboard
├── practice/page.tsx       # → PracticeDashboard
└── unused/page.tsx         # → Sandbox de validação

scripts/seed-data/
└── race-calendar-data.ts   # Fonte única de verdade para calendário + sessões
```

---

## 💾 Banco de Dados — Entidades Implementadas

> Referência completa: `DB_ENTITY_ROADMAP.md`

| Tabela | Status | Descrição |
|---|---|---|
| `race_weekends` | ✅ | Evento por etapa (season, round, circuit, country) |
| `race_sessions` | ✅ | Sessão por fim de semana (`session_code`, `source`, `is_sprint_weekend`) |
| `session_status_events` | ✅ | Histórico de mudanças de estado da sessão |
| `drivers` | ✅ | Pilotos com FK para `teams` (sem duplicação de team_name) |
| `teams` | ✅ | Construtores (composição via relacionamento com `drivers`) |
| `session_results` | ✅ | Resultado final por piloto e sessão |
| `race_control_messages` | ✅ | Mensagens oficiais (flags, incidentes, escopo) |
| `lap_summaries` | ✅ | Resumo por volta (S1/S2/S3, pit_in, pit_out) |
| `telemetry_snapshots` | ✅ | Amostras de telemetria com retenção curta e amostragem configurável |
| `media_videos` | 🔻 | Descontinuada (removida em mar/2026) |
| `media_galleries` | ✅ | Galerias |
| `media_podcasts` | ✅ | Podcasts |
| `news_articles` | ✅ | Notícias |

**Índices criados:**
- `race_sessions(weekend_id, start_time_utc)`
- `session_status_events(session_id, occurred_at_utc desc)`
- `race_control_messages(session_id, occurred_at_utc desc)`
- `lap_summaries(session_id, driver_id, lap_number)`
- `telemetry_snapshots(session_id, captured_at_utc desc)`

**Variáveis de ambiente para telemetria:**

| Variável | Padrão | Descrição |
|---|---|---|
| `LIVE_TIMING_TELEMETRY_SAMPLE_MS` | `2000` | Intervalo de amostragem |
| `LIVE_TIMING_TELEMETRY_RETENTION_HOURS` | `24` | Retenção dos snapshots |
| `LIVE_TIMING_TELEMETRY_MAX_DRIVERS_PER_SNAPSHOT` | `20` | Cap de pilotos por snapshot |
| `LIVE_TIMING_TELEMETRY_PERSIST_ENABLED` | ligado | Toggle de persistência |

---

## 💿 Política de Persistência e Cache

> Referências: `LIVE_TIMING_DATA_POLICY.md`, `LIVE_TIMING_PERSISTENCE_POC.md`

### Regra geral

- Dado muda em sub-segundo sem valor histórico → **não persistir** (Redis TTL curto)
- Dado explica o que aconteceu na sessão (replay, auditoria, analytics) → **persistir no PostgreSQL**

### O que persistir no PostgreSQL

| Domínio | Retenção sugerida |
|---|---|
| Calendário e sessões | 2+ anos |
| Estado de sessão (status events) | 1 ano |
| Race Control (flags, incidentes) | 1 ano |
| Resultado agregado (classificação, voltas, gaps) | 1 ano |

### O que não persistir por padrão

| Domínio | Estratégia |
|---|---|
| Payload bruto completo por poll | Não salvar |

### Redis

| Chave | TTL | Uso |
|---|---|---|
| `session-banner:v1` | 30s (`REDIS_SESSION_BANNER_TTL_SECONDS`) | Banner de sessão live/next na homepage |
| Snapshot quente | 2–10s | Leaderboard e estado de sessão para UI |

### Arquitetura do Snapshot Store

- Estado compartilhado em memória no servidor (TTL adaptativo por status de sessão)
- Dedupe de concorrência via `inFlightFetch` — evita requisições duplas simultâneas
- Métricas coletadas: `cacheHits`, `upstreamFetches`, `inFlightJoins`, `errors`
- Histórico curto (`SNAPSHOT_HISTORY_LIMIT`) para inspeção pós-sessão

### Log de observabilidade

- Arquivo: `logs/live-timing.ndjson` (rotação a 5MB → `live-timing.1.ndjson`)
- Eventos: `snapshot_fetched`, `snapshot_fetch_failed`, `cache_hit` (amostrado), `inflight_join` (amostrado)
- Toggle: `LIVE_TIMING_FILE_LOG=0` desabilita escrita
- Relatório automático: `pnpm analyze:live-log`

---

## 🌍 Internacionalização (i18n)

> Referências: `I18N_NAMING.md`, `I18N_SETUP.md`

**Locales suportados:** `en` (padrão), `pt`, `es`

**Namespaces de tradução por domínio:**

| Namespace | Uso |
|---|---|
| `home.*` | Homepage (`navigation`, `sections`, `common`, `footer`) |
| `liveTiming.*` | Live timing (`unused`, `championshipPredictionCompact`) |

**Padrões de uso:**

```tsx
// Server Component
import { useTranslations } from 'next-intl'
const t = useTranslations('home.navigation')

// Client Component
import { useI18n } from '@/lib/i18n/client'
const { t } = useI18n()
t('liveTiming.championshipPredictionCompact.titleLive')

// Link interno (mantém locale)
import { Link } from '@/lib/i18n/routing'
```

**Regras de nomeação:**
- `camelCase` para namespaces e chaves
- Nomeie por contexto de UI, não por tecnologia
- Mesma chave nos 3 idiomas (`pt.json`, `en.json`, `es.json`)
- Build valida chaves ausentes

---

## 🔧 Tuning do TrackMapLive

> Painel de calibração disponível em `?trackDebug=1`

**Métricas ao vivo:**
- `pollInterval`, `jitter`, `tau`, `buffer`, `edgeCars`, `holdFrames`, `sampleAge(max)`

**Controles:**
- `tauFactor`, `bufferFactor`, `minBuffer`, `jitterFactor`, `reset tune`

**Regras rápidas:**
- Se ainda há "travadinha": aumentar `minBuffer` e/ou `jitterFactor`
- Se estiver atrasado: reduzir `bufferFactor` e/ou `minBuffer`
- Objetivo: `edgeCars` perto de 0, crescimento de `holdFrames` baixo

---

## 📅 Histórico de Versões

### v3.9 — Fev/2026 — Endpoint Configurável via Env Var + Servidor Hetzner (obsoleto)

**Contexto histórico:** esta versão usava F1MV/MultiViewer. Esse caminho foi removido; o runtime atual usa somente SignalR.

**Mudanças principais:**
- Substituído posteriormente por SignalR server-side e API interna `/[locale]/api/live-timing`.

**Variáveis de ambiente:**

| Variável | Padrão | Descrição |
|---|---|---|
| `SIGNALR_HUB_URL` | `https://livetiming.formula1.com/signalrcore` | URL do hub SignalR ou proxy equivalente |

---

### v3.8 — Fev/2026 — Remoção de CarData
Decisão de produto: o sistema não utilizará mais dados de `CarData` (RPM, velocidade, marcha, acelerador, freio, DRS).

**Arquivos removidos:**
- `components/telemetry-card.tsx`
- `components/live-timing/analysis/QualifyingCarDataComparator.tsx`
- `components/live-timing/analysis/TelemetryVolumeHealthCard.tsx`
- `lib/live-timing/persistence/qualifying-lap-telemetry-store.ts`
- `lib/live-timing/persistence/qualifying-car-data-comparison.ts`
- `lib/db/telemetry-snapshots.ts`
- `lib/db/telemetry-volume.ts`
- `app/[locale]/api/telemetry-volume/` (rota removida)

**Arquivos limpos:**
- `lib/live-timing/types.ts` — removidas interface `Telemetry` e campo `telemetry` de `LiveTimingState` e `CarData` de `F1LiveTimingRawState`
- `lib/live-timing/constants.ts` — removido `TELEMETRY_CHANNELS`
- `lib/live-timing/parsers.ts` — removida `parseTelemetry()`
- `lib/live-timing/api.ts` + `snapshot-store.ts` — `CarData` removido do payload de Live Timing
- `app/[locale]/api/live-timing/route.ts` — modo `qualifying-car-comparison` removido
- `lib/db/schema.ts` — tabela `telemetrySnapshots` removida
- `lib/db/session-analytics.ts`, `session-analytics-types.ts` — campos de telemetria removidos
- `components/live-timing/analysis/SessionAnalyticsOverviewCard.tsx` — linha de "Telemetria" removida
- `components/live-timing/dashboards/LiveTimingDashboard.tsx` — `TelemetryVolumeHealthCard` removido
- `app/[locale]/api-docs/page.tsx` — seções de telemetria e CarData removidas
- `components/live-timing/LiveTimingProvider.tsx` — `parseTelemetry`, `rawState`, `telemetry: null` removidos
- `app/[locale]/api/telemetry-snapshots/` — rota removida

---

### v3.7 — Fev/2026 — Polish de Componentes + Homepage
Correções de UX baseadas em revisão completa da página `/unused` e promoção do ChampionshipPrediction para a homepage.

**Mudanças principais:**
- `RaceTraceChart`: tooltip ao hover mostra nome do piloto ao lado do gap.
- `LapPositionChart` (Evolução de Posição): tooltip com nome do piloto ao hover.
- `TrackMapLive`: removido badge "Pista" ao lado dos nomes; melhor distribuição dos labels; painel de contagem exibe último status de sessão (`TrackStatus`/`SessionData`).
- `MiniSectorGrid`: cores corrigidas (Roxo = melhor absoluto, Amarelo = melhor pessoal); duas linhas por piloto (volta atual + melhores parciais acumuladas); ordenado por posição.
- `ChampionshipPredictionCompact`: promovido para homepage no lugar do componente de destaque — visível somente durante corrida ao vivo.

---

### v3.6 — Fev/2026 — UX do Dashboard + Endpoint de Sessão
Melhorias nos dashboards de qualificação e corrida, e criação do endpoint agregado de sessão.

**Mudanças principais:**
- `QualifyingDashboard`: coluna **Theoretical Best Lap** (soma dos melhores S1+S2+S3 por piloto).
- `TimingTable`: expansão inline por piloto para histórico de voltas.
- Endpoint `GET /[locale]/api/live-timing?mode=dashboard` — retorna sessão agregada centralizada.
- Cards de métricas centralizados + timeline compacta no dashboard principal.

---

### v3.5 — Fev/2026 — Cleanup de Componentes Legados + Padronização i18n
Consolidação da base com remoção de componentes descontinuados e padronização de namespaces.

**Mudanças principais:**
- Remoção de componentes legados: `SessionInfoCard`, `SessionOverviewCard`, `SessionClock`, `PitStopTimingChart`, `SessionTimeline`, `LapHistoryInspector`, `QualifyingLapAnalysisCharts`.
- Limpeza do barrel `components/live-timing/index.ts`.
- Internacionalização do `ChampionshipPredictionCompact` e da página `/live-timing/unused`.
- Padronização de namespaces: `home.*` e `liveTiming.*`.
- Criação do guia `I18N_NAMING.md` e atualização do `I18N_SETUP.md`.

---

### v3.4 — Fev/2026 — Race Trace + Escalabilidade de Sessão Longa
Implementado `RaceTraceChart` com leitura contínua por amostra.

**Mudanças principais:**
- Parser dedicado para Race Trace usando `GapToLeader` com fallback por soma de `IntervalToPositionAhead`.
- Gráfico contínuo por amostra (não só por volta) com marcações de volta no eixo X.
- Filtros rápidos: `Top 5`, `Top 10`, `Top 15`, `Todos`, `Até +20s`.
- Toggle de janela: `Janela Atual` vs `Desde 1ª volta`.
- Downsampling no modo histórico completo.

---

### v3.3 — Fev/2026 — Persistência PoC + Logging de Observabilidade
Arquitetura de dados para reduzir carga em sessões longas e permitir debug pós-corrida.

**Mudanças principais:**
- Endpoint interno `app/[locale]/api/live-timing` com modos `latest/history/stats`.
- Snapshot store em memória com TTL adaptativo + dedupe de concorrência.
- Cliente com dedupe de request em voo e microcache.
- Log estruturado NDJSON (`logs/live-timing.ndjson`) com rotação simples.
- Script `pnpm analyze:live-log` para relatório automático.

---

### v3.2 — Fev/2026 — Smoothing Contínuo + Tuning em Tempo Real
Refino do `TrackMapLive` para reduzir micro-travadas entre polls.

**Mudanças principais:**
- Interpolação por buffer de samples por carro (estilo streaming).
- Buffer e tau adaptativos ao intervalo/jitter real dos batches.
- Painel de debug/tuning com `?trackDebug=1`.
- Métricas ao vivo: `pollInterval`, `jitter`, `tau`, `buffer`, `edgeCars`, `holdFrames`, `sampleAge(max)`.

---

### v3.1 — Fev/2026 — Mapa da Pista ao Vivo
Implementado `TrackMapLive` — mapa SVG 2D usando `Position.X / Position.Y`.

**Destaques técnicos:**
- SVG 900×560 com viewBox responsivo (`w-full h-auto`).
- Escala uniforme (sem distorção) com centralização automática.
- Bounds detectados automaticamente do primeiro snapshot real (não hardcoded).
- Traçado acumulado em `useRef<Map>` — sem re-render no acúmulo, flush periódico.
- Carros na pista: círculo preenchido + número. Carros no pit: círculo vazado com opacidade reduzida.

---

### v3.0 — Fev/2026 — Novos Campos da API (8 componentes)
Cobertura expandida de 58% → 81%.

| Campo | Componente |
|---|---|
| `LapSeries` | `LapPositionChart` |
| `WeatherDataSeries` | `WeatherHistoryChart` |
| `TimingData.Segments` | `MiniSectorGrid` |
| `TimingData.Speeds I1/I2/FL/ST` | `SpeedTrapsTable` |
| `ChampionshipPrediction` | `ChampionshipPredictionCard` |
| `ContentStreams` + `AudioStreams` | `ContentStreamsPanel` |
| `TimingData.GapToLeader` | `RaceTraceChart` |
| `Position.{X,Y,Z}` | `TrackMapLive` (via v3.1) |

---

### v2.6 — TimingTable com Tyre History Integrado
- Stints visualizados diretamente na tabela principal.
- Colunas dinâmicas por stint (composto + voltas).

### v2.5 — RaceDashboard Simplificado
- Layout 9/3 colunas (timing protagonista).

### v2.3 — Gap Calculation Fix
- Gap usa `IntervalToPositionAhead` real com fallback para `GapToLeader`.

### v2.1 — TimingTable Estendido
- Modo `extended={true}` com S1/S2/S3 + TopSpeed inline.

---

## 🎯 Próximas Oportunidades

### 🔴 Alta Prioridade

#### 1. Promover Componentes de /unused para Dashboards

| Componente | Dashboard sugerido | Notas |
|---|---|---|
| `LapPositionChart` | Race | Muito útil em corridas longas |
| `WeatherHistoryChart` | Todos | Widget lateral nos dashboards |
| `MiniSectorGrid` | Qualifying | Mais relevante em quali |
| `SpeedTrapsTable` | Practice / Qualifying | Útil em sessões de setup |
| `RaceTraceChart` | Race | Candidato direto para painel principal |
| `TrackMapLive` | Race / Qualifying | Pronto para integração após polish |

---

### 🟡 Média Prioridade

#### 2. Replay de Sessão com Scrubber
Usar dados arquivados para:
- Rebobinar sessão concluída
- Slider de tempo com `ExtrapolatedClock`
- Útil para análise pós-qualificação

---

### 🟢 Baixa Prioridade

#### 3. ArchiveStatus Visual
**Campo:** `ArchiveStatus.Status` (`Generating`, `Complete`)
Indicador de quando os dados históricos estão disponíveis para download.

#### 4. ContentStreams — DRM / F1 TV Integration
Stream `monterosa` (Commentary) requer autenticação F1 TV.
- Opção A: integração com F1 TV API (requer assinatura)
- Opção B: link externo para o player oficial

#### 5. Persistência Durável (evolução da PoC)
- Trocar snapshot store em memória por PostgreSQL
- Job de compactação/retention para snapshots antigos
- Endpoints paginados por sessão/piloto/volta
- Monitoramento de latência e tamanho de payload

#### 6. Analytics de Sessão
- API agregada: incidentes, evolução de ritmo, degradação de pneus
- Consumo progressivo de dados persistidos em vez de apenas estado volátil
- Jobs de manutenção: contagem por sessão, latência de ingestão, taxa de deduplicação
