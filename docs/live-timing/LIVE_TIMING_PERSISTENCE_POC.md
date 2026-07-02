# Live Timing Persistence PoC

## Objetivo
Validar um caminho de persistência para o live timing que reduza recomputação por usuário, suporte concorrência de leitura e sirva como base para migração futura para banco.

## Estado atual observado
- O front faz polling frequente e havia múltiplos pontos consumindo `fetchLiveTiming`.
- Cada consumidor podia provocar requisições redundantes ao GraphQL de origem.
- Não existia camada central de snapshot compartilhado entre usuários.

## PoC implementada
### 1) Snapshot store compartilhado no servidor
Arquivo: `lib/live-timing/persistence/live-timing-snapshot-store.ts`

- Mantém snapshots recentes em memória com TTL curto.
- TTL adaptativo por status de sessão:
  - `Started`: 500ms
  - `Finished` / `Ends` / `Inactive`: 5000ms
- Dedupe de concorrência com `inFlightFetch` para evitar fetch duplicado simultâneo.
- Coleta métricas de operação:
  - `cacheHits`
  - `upstreamFetches`
  - `inFlightJoins`
  - `errors`
- Mantém histórico curto (`SNAPSHOT_HISTORY_LIMIT`) para inspeção/depuração.

### 2) Endpoint de leitura central
Arquivo: `app/[locale]/api/live-timing/route.ts`

- `GET ?mode=latest` retorna último snapshot com `meta` e `stats`.
- `GET ?mode=history&limit=N` retorna histórico resumido.
- `GET ?mode=stats` retorna métricas do store.
- `refresh=1` força atualização no upstream.

### 3) Cliente apontando para camada central
Arquivo: `lib/live-timing/api.ts`

- `fetchLiveTiming` passa a consumir `/<locale>/api/live-timing`.
- Mantém fallback para `GQL_ENDPOINT` direto em caso de indisponibilidade da rota interna.
- Inclui dedupe de request em voo no cliente (`inFlightRequest`).
- Inclui microcache de resposta para reduzir bursts entre componentes em polling.

### 4) Logging em arquivo para pós-análise
Arquivos:
- `lib/live-timing/persistence/live-timing-file-log.ts`
- `lib/live-timing/persistence/live-timing-snapshot-store.ts`

- Log estruturado em NDJSON em `logs/live-timing.ndjson`.
- Rotação simples por tamanho (5MB), mantendo também `logs/live-timing.1.ndjson`.
- Eventos registrados:
  - `snapshot_fetched`
  - `snapshot_fetch_failed`
  - `cache_hit` (amostrado)
  - `inflight_join` (amostrado)
- Toggle por ambiente:
  - `LIVE_TIMING_FILE_LOG=0` desabilita escrita em arquivo.

## Como usar durante/apos uma corrida
1. Rode a sessão normalmente em `live-timing`.
2. Após alguns minutos, abra `logs/live-timing.ndjson`.
3. Procure padrões de:
  - crescimento de `durationMs` em `snapshot_fetched`
  - picos de `snapshot_fetch_failed`
  - relação `cacheHits` vs `upstreamFetches`
  - aumento de `inFlightJoins` (sinal de concorrência alta)
4. Se o arquivo atingir limite, os dados anteriores estarão em `logs/live-timing.1.ndjson`.

### Relatório automático pós-sessão
- Comando:
  - `pnpm analyze:live-log`
- Saídas geradas em `logs/`:
  - `live-timing-report.latest.json`
  - `live-timing-report.latest.md`
- O script calcula automaticamente:
  - resumo da sessão (janela, totais, cache ratio)
  - latência média/p95 de fetch
  - intervalo médio/p95 entre snapshots
  - top spikes de latência
  - outliers de duração e cadência

## Modelo de dados inicial (alvo em banco)
### Tabela `live_sessions`
- `id`
- `meeting_key`
- `session_key`
- `session_type`
- `status`
- `started_at`
- `ended_at`
- `created_at`

### Tabela `live_snapshots`
- `id`
- `session_id` (FK)
- `captured_at`
- `payload_raw` (JSONB)
- `driver_count`
- `current_lap`
- `race_message_count`
- `radio_capture_count`

### Tabela `driver_laps`
- `id`
- `session_id` (FK)
- `snapshot_id` (FK)
- `racing_number`
- `lap_number`
- `lap_time`
- `lap_time_source`
- `position`

### Tabela `driver_sectors`
- `id`
- `session_id` (FK)
- `snapshot_id` (FK)
- `racing_number`
- `lap_number`
- `sector_1`
- `sector_2`
- `sector_3`

### Tabela `telemetry_snapshots`
- `id`
- `session_id` (FK)
- `snapshot_id` (FK)
- `racing_number`
- `speed`
- `rpm`
- `gear`
- `throttle`
- `brake`
- `drs`

## Estratégia de ingestão (MVP)
1. Polling único no servidor (ou rota acionada sob demanda com TTL).
2. Normalização do payload por snapshot.
3. Persistência assíncrona em lote (batch) no banco.
4. Leitura para UI via snapshot consolidado, sem recomputar tudo no cliente.

## Impacto esperado em performance e concorrência
- Menos chamadas redundantes ao upstream por usuário/componente.
- Leitura concorrente compartilhando o mesmo snapshot em memória.
- Menor recomputação no cliente e menor custo por render.
- Base pronta para mover o histórico para banco com retenção maior.

## Riscos e limitações da PoC
- Estado em memória é volátil (reinício do servidor limpa histórico).
- Em múltiplas instâncias, cada instância terá cache próprio.
- Não substitui persistência durável; valida apenas arquitetura e fluxo.

## Próxima evolução recomendada
1. Trocar store em memória por persistência em Postgres.
2. Adicionar job de compactação/retention para snapshots antigos.
3. Expor endpoints de consulta por sessão/piloto/lap com paginação.
4. Criar monitoramento de latência e tamanho de payload por snapshot.
