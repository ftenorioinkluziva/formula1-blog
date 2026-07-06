# Component Data Access Matrix

## Home (`app/[locale]/page.tsx`)

| Componente | Fonte de dados | Endpoint interno | Persistência principal | Status |
|---|---|---|---|---|
| `Navigation` | Config local | — | — | Local por design |
| `SessionBanner` | API interna | `GET /[locale]/api/session-banner` | PostgreSQL + Redis cache | DB/API |
| `ChampionshipPredictionCompact` | Live timing | `GET /[locale]/api/live-timing` (via `fetchLiveTiming`) | Snapshot em memória (atual), origem SignalR | API interna |
| `HeroSection` | Notícias + pilotos | `GET /[locale]/api/news`, `GET /[locale]/api/drivers` | PostgreSQL | DB/API |
| `StandingsTicker` | Pilotos | `GET /[locale]/api/drivers` | PostgreSQL | DB/API |
| `TeamProfiles` | Equipes | `GET /[locale]/api/teams` | PostgreSQL | DB/API |
| `DriverProfiles` | Pilotos | `GET /[locale]/api/drivers` | PostgreSQL | DB/API |
| `NewsSection` | Notícias | `GET /[locale]/api/news` | PostgreSQL | DB/API |
| `MultimediaSection` | Mídia + galerias | `GET /[locale]/api/multimedia`, `GET /[locale]/api/gallery/[id]` | PostgreSQL | DB/API |
| `StandingsSection` | Pilotos + equipes | `GET /[locale]/api/drivers`, `GET /[locale]/api/teams` | PostgreSQL | DB/API |
| `ScheduleSection` | Calendário/sessões | `GET /[locale]/api/race-weekends` | PostgreSQL | DB/API |
| `SiteFooter` | Config local | — | — | Local por design |

## Rota de detalhe de artigo (`/[locale]/news/[id]`)

| Componente | Fonte de dados | Endpoint interno | Persistência principal | Status |
|---|---|---|---|---|
| `app/[locale]/news/[id]/page.tsx` | Artigo único | `lib/db/news.ts::getNewsById` | PostgreSQL | DB (Server Component) |
| `NewsArticleDetail` | Props do Server Component | — | — | Client Component |

## API de galeria

| Rota | Fonte | Descrição |
|---|---|---|
| `GET /[locale]/api/gallery/[id]` | `lib/db/multimedia.ts::getGalleryImages` | Retorna imagens de uma galeria por ID |

## Observações

- Não deve haver componente com acesso direto a provedor externo de Live Timing.
- O frontend consome snapshots exclusivamente por `/api/live-timing` para evitar fan-out de polling no cliente.
- `MultimediaSection` usa `GalleryViewer` (lightbox fullscreen) para galerias e `VideoPlayer` para vídeos — ambos montados condicionalmente fora do `<section>`.
- `MultimediaSection` mantém contrato de `videos` na API, mas o backend retorna lista vazia após descontinuação de `media_videos`.
- Navegação de artigos migrada de modal para rota dedicada (`/[locale]/news/[id]`) com suporte a SSR/SEO.
- `ScheduleSection` e `RaceDetailModal` renderizam data/hora no fuso local do usuário a partir de UTC (`raceStartUtc` e `sessions.startTimeUtc`).
