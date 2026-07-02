# Database Entity Roadmap

## Objetivo

Mapear entidades prioritárias para evoluir do calendário para um domínio completo de sessão ao vivo, eventos e análise histórica.

## Status atual (mar/2026)

- ✅ Concluído: `race_weekends`
- ✅ Concluído: evolução de `race_sessions` (`weekend_id`, `session_code`, `source`, `is_sprint_weekend`)
- ✅ Concluído: `session_status_events`
- ✅ Concluído: `drivers` (inclui sync de standings via Jolpica-F1 API)
- ✅ Concluído: `teams` (inclui sync de standings via Jolpica-F1 API)
- ✅ Concluído: `session_results`
- ✅ Concluído: `race_control_messages`
- ✅ Concluído: `lap_summaries`
- ✅ Concluído: `telemetry_snapshots` (com retenção curta e amostragem)
- ✅ Concluído: núcleo fantasy (`fantasy_seasons`, `fantasy_rulesets`, `fantasy_profiles`, `fantasy_engineers`, `fantasy_assets`, `fantasy_asset_prices`, `fantasy_round_entries`, `fantasy_round_holdings`, `fantasy_transfers`, `fantasy_predictions`, `fantasy_round_scores`, `fantasy_score_items`)

### Normalização já aplicada

- `drivers` agora referencia `teams` por `team_id` (FK), sem `team_name`/`team_color` duplicados.
- `teams` não armazena mais `driver1`/`driver2` como colunas fixas; composição vem do relacionamento com `drivers`.
- `race_sessions` deixou de duplicar metadados de fim de semana (`season`, `round`, `name`, `circuit`, `country`).
- `session_code` tornou-se obrigatório e único por fim de semana (`weekend_id + session_code`).
- Fluxo de migração legado documentado: `db:baseline` + `db:migrate`.

## Prioridade 1 — Núcleo operacional

### 1) `race_weekends`
Representa o evento do fim de semana por etapa.

Status: ✅ Concluído

Campos sugeridos:
- `id`
- `season`
- `round`
- `grand_prix_name`
- `circuit`
- `country`
- `location`
- `created_at`
- `updated_at`

### 2) `race_sessions` (já existe)
Representa cada sessão do fim de semana.

Status: ✅ Concluído (incluindo normalização)

Evoluções sugeridas:
- `weekend_id` (FK para `race_weekends`)
- `session_code` (`P1`, `P2`, `P3`, `SQ`, `SPR`, `Q`, `R`)
- `source` (`seed`, `api`, `manual`)
- `is_sprint_weekend` (boolean)

### 3) `session_status_events`
Histórico de mudanças de estado da sessão.

Status: ✅ Concluído

Campos sugeridos:
- `id`
- `session_id` (FK)
- `status` (`scheduled`, `started`, `red_flag`, `finished`, etc.)
- `status_reason`
- `occurred_at_utc`
- `ingested_at`

## Prioridade 2 — Dados de corrida

### 4) `drivers`
Cadastro de pilotos para relacionamento com resultados e telemetria.

Status: ✅ Concluído (normalizado com `team_id`, standings sync via Jolpica-F1 API)

Campos sugeridos:
- `id`
- `driver_number`
- `code` (ex: `VER`) — usado como chave de mapeamento no sync de standings
- `full_name`
- `team_name`
- `country`
- `points`, `position`, `wins`, `podiums` — atualizados via `pnpm db:sync-standings`

Ordenação de standings: `points DESC, position ASC, full_name ASC`

### 5) `session_results`
Resultado final por piloto e sessão.

Status: ✅ Concluído

Campos sugeridos:
- `id`
- `session_id` (FK)
- `driver_id` (FK)
- `position`
- `best_lap_time`
- `gap_to_leader`
- `points`
- `status` (`finished`, `dnf`, `dns`, `dsq`)

### 6) `race_control_messages`
Mensagens oficiais da direção de prova.

Status: ✅ Concluído

Campos sugeridos:
- `id`
- `session_id` (FK)
- `message_type`
- `flag`
- `lap`
- `message_text`
- `racing_number` (nullable)
- `occurred_at_utc`

## Prioridade 3 — Telemetria e analytics

### 7) `lap_summaries`
Resumo por volta para consultas rápidas sem depender de telemetria bruta.

Status: ✅ Concluído

Campos sugeridos:
- `id`
- `session_id` (FK)
- `driver_id` (FK)
- `lap_number`
- `lap_time`
- `sector_1`
- `sector_2`
- `sector_3`
- `pit_in`
- `pit_out`

### 8) `telemetry_snapshots` (opcional por custo)
Amostras agregadas para análises específicas e retenção curta.

Status: ✅ Concluído (retenção/amostragem ativas)

Regras atuais de custo/retenção:

- `LIVE_TIMING_TELEMETRY_SAMPLE_MS` (padrão: `2000`)
- `LIVE_TIMING_TELEMETRY_RETENTION_HOURS` (padrão: `24`)
- `LIVE_TIMING_TELEMETRY_MAX_DRIVERS_PER_SNAPSHOT` (padrão: `20`)
- `LIVE_TIMING_TELEMETRY_PERSIST_ENABLED` (padrão: ligado)

Campos sugeridos:
- `id`
- `session_id` (FK)
- `driver_id` (FK)
- `captured_at_utc`
- `speed`
- `rpm`
- `gear`
- `throttle`
- `brake`
- `drs`

## Índices recomendados

- ✅ `race_sessions(weekend_id, start_time_utc)`
- ✅ `session_status_events(session_id, occurred_at_utc desc)`
- ✅ `race_control_messages(session_id, occurred_at_utc desc)`
- ✅ `lap_summaries(session_id, driver_id, lap_number)`
- ✅ `telemetry_snapshots(session_id, captured_at_utc desc)`

## Entidades de fantasy (mar/2026)

### `fantasy_seasons`
- ✅ Concluído
- temporada fantasy ativa, budget cap e metadados básicos

### `fantasy_rulesets`
- ✅ Concluído
- regras operacionais da temporada: free transfers, penalties, lock phase, team hold minimum e predictions enabled

### `fantasy_profiles`
- ✅ Concluído
- identidade MVP baseada em `session_key`
- suporta `display_name` e `favorite_team_id`

### `fantasy_engineers`
- ✅ Concluído
- representa o Pit Wall Lead por equipe
- modelo físico já alinhado ao produto: sem dependência estrutural de `driver_id`
- unicidade atual por `season + team_id + active_from_round`

### `fantasy_assets`
- ✅ Concluído
- catálogo único de assets `driver`, `team` e `engineer`
- `source_driver_id`, `source_team_id` e `source_engineer_id` permitem auditar a origem do ativo

### `fantasy_asset_prices`
- ✅ Concluído
- preços por rodada, `price_delta` e `performance_index`
- usado tanto na UI quanto no lock de holdings

### `fantasy_round_entries`
- ✅ Concluído
- snapshot principal da rodada por profile
- guarda budget, status, lock timestamps e janela mínima de hold da equipe

### `fantasy_round_holdings`
- ✅ Concluído
- slots travados por rodada: `driver_1`, `driver_2`, `team`, `engineer`
- persiste `locked_price` e `acquired_round`

### `fantasy_transfers`
- ✅ Concluído
- base para histórico e penalidades de troca

### `fantasy_predictions`
- ✅ Concluído
- pole, winner, podium, fastest lap, fastest pit team, safety car band e red flag

### `fantasy_round_scores`
- ✅ Concluído
- score persistido por rodada com blocos separados: `drivers_score`, `team_score`, `engineer_score`, `predictions_score`, `total_score`
- `is_official` diferencia score live de score oficial

### `fantasy_score_items`
- ✅ Concluído
- breakdown auditável do score com `score_block`, `score_type`, `source_table`, `source_record_id` e `meta_json`

### Regras de produto já refletidas no domínio fantasy

- roster atual: `2` pilotos + `1` equipe + `1` Pit Wall Lead + predictions
- lock da rodada no início do qualifying
- seleção de Pit Wall Lead livre entre todas as equipes do grid
- score de Pit Wall Lead puramente team-based
- leaderboard por rodada e temporada usando apenas scores persistidos
- simulação local de massa via `scripts/simulate-fantasy-users.ts`

## Entidades de mídia (fev/2026)

### `media_videos`
- 🔻 Descontinuado em mar/2026
- Tabela removida por migration `0032_drop_media_videos.sql`
- API de multimídia mantém contrato de `videos`, mas retorna lista vazia

### `media_galleries`
- ✅ Concluído (campos: `title`, `image_count`, `category`, `cover_image_url`, `folder_key`, `sort_order`)
- `folder_key`: chave estável para sync automático via `pnpm db:sync-galleries`
- Estrutura no filesystem: `public/images/galleries/{evento}/` ou `public/images/galleries/{grupo}/{evento}/`
- URLs armazenadas como Cloudinary (`https://res.cloudinary.com/...`) — migração concluída em fev/2026

### `gallery_images`
- ✅ Concluído (campos: `gallery_id` FK, `image_url`, `caption`, `sort_order`)
- ON DELETE CASCADE de `media_galleries`
- Caption gerado automaticamente do filename (slug → Title Case)
- API: `GET /[locale]/api/gallery/[id]`
- URLs armazenadas como Cloudinary — migração concluída em fev/2026

### `media_podcasts`
- ✅ Concluído (campos: `title`, `episode`, `duration`, `guest`, `sort_order`)

### `news_articles`
- ✅ Concluído
- Rota dedicada: `app/[locale]/news/[id]/page.tsx` com `generateMetadata` para SEO
- Componente `NewsArticleDetail` com share buttons (WhatsApp, Telegram, Copiar link)

## Migrations aplicadas (atualizado)

| idx | tag | descrição |
|---|---|---|
| 0–9 | ... | Entidades de live timing e corridas |
| 10 | `0010_violet_talisman` | Schema multimedia inicial |
| 11 | `0011_rename_thumbnail_to_video_url` | Rename coluna |
| 12 | `0012_create_gallery_images` | Tabela `gallery_images` |
| 13 | `0013_add_gallery_folder_key` | Coluna `folder_key` em `media_galleries` |
| 14 | `0014_add_video_thumbnail_and_folder_key` | Colunas `thumbnail_url` e `folder_key` em `media_videos` |
| 24 | `0024_create_race_intervals` | Tabela `race_intervals` |
| 25 | `0025_create_overtakes` | Tabela `overtakes` |
| 26 | `0026_create_car_telemetry` | Tabela `car_telemetry` |
| 27 | `0027_create_team_radio` | Tabela `team_radio` |
| 28 | `0028_create_pole_videos` | Tabela `pole_videos` |
| 29 | `0029_drop_overtakes` | Remoção da tabela histórica `overtakes` |
| 30 | `0030_create_fantasy_core` | Núcleo do fantasy: perfis, assets, holdings, predictions e scores |
| 31 | `0031_drop_fantasy_engineer_driver_dependency` | Consolidação do Pit Wall Lead por equipe e remoção de `driver_id` |
| 32 | `0032_drop_media_videos` | Remoção da tabela `media_videos` |

## Integrações externas

### Jolpica-F1 API (standings sync)
- Client: `lib/jolpica/client.ts`
- DB sync: `lib/db/standings.ts`
- Script CLI: `scripts/sync-standings.ts` → `pnpm db:sync-standings [season] [round]`
- API route: `POST /[locale]/api/sync-standings`
- Mapeia drivers por `code`, teams por nome com aliases internos
- Atualiza `points`, `position`, `wins`, `podiums` (drivers) e `points`, `position`, `wins` (teams)

## Próxima iteração sugerida

1. Adicionar relatório operacional para a coorte simulada do fantasy, reutilizando `fantasy-sim-01` … `fantasy-sim-10` entre rodadas.
2. Adicionar painel/API agregada de analytics por sessão (ex.: incidentes, evolução de ritmo, degradação).
3. Refinar política operacional por ambiente (dev/staging/prod) para telemetria (`sample`, `retention`, `driver cap`).
4. Executar a fase 2 do fantasy conforme backlog em `FANTASY_PHASE_2_BACKLOG.md`.
