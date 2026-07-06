# Política de Persistência e Cache (API Live Timing)

## Objetivo

Persistir apenas dados com valor de produto e histórico, mantendo dados de alta frequência em cache temporário para reduzir custo e latência.

## Camadas

1. **Redis (quente / curto prazo)**
   - Estado de leitura frequente para UI.
   - TTL curto para reduzir pressão no banco.
2. **PostgreSQL (durável / consulta histórica)**
   - Dados necessários para experiência do usuário, histórico e analytics.

## O que persistir no PostgreSQL

| Domínio | Persistir | Retenção sugerida |
|---|---|---|
| Calendário e sessões | `race_sessions`, status e horários | 2+ anos |
| Estado de sessão | status oficial por sessão | 1 ano |
| Race Control | eventos oficiais (flags, incidentes) | 1 ano |
| Resultado agregado | classificação, voltas, gaps agregados | 1 ano |

## O que não persistir por padrão

| Domínio | Estratégia |
|---|---|
| Telemetria bruta em alta frequência | Redis curto prazo, descarte por TTL |
| Payloads transitórios sem uso posterior | não salvar |

## Estratégia Redis (inicial)

| Chave | Valor | TTL |
|---|---|---|
| `session-banner:v1` | sessão `live` ou `next` para header | 30s |

Variáveis de ambiente:

- `REDIS_URL`
- `REDIS_SESSION_BANNER_TTL_SECONDS`

## Estratégia recomendada agora (com BD disponível)

### 1) Ingestão única e centralizada

- Manter **somente backend** conectado ao SignalR oficial e expondo snapshots por rotas internas.
- Frontend deve consumir apenas rotas internas (`/[locale]/api/*`).
- Evitar polling direto no browser para reduzir fan-out e carga no provedor de live timing.

### 2) O que gravar no PostgreSQL imediatamente

- **Eventos de sessão**: mudanças de status (`scheduled`, `started`, `finished`, `aborted`) com timestamp.
- **Race Control**: mensagens oficiais, flags, escopo, setor, carro.
- **Snapshots agregados de classificação**: posição, gap, melhor volta, pneus, pit count (cadência baixa, ex.: 5-10s durante sessão ativa).
- **Resultados finais** por sessão (já alinhado com `session_results`).

### 3) O que manter fora do PostgreSQL (por enquanto)

- **Telemetria bruta de alta frequência** (RPM, throttle, brake, speed por canal) em granularidade de sub-segundo.
- Payload bruto completo do SignalR a cada poll.

### 4) Cache e retenção sugeridos

- Redis para snapshot quente por sessão e leaderboard (`TTL 2-10s`).
- PostgreSQL para histórico e analytics:
   - Race control / status events: 12 meses
   - Snapshots agregados: 3-6 meses (ou compressão diária)
   - Resultados finais: retenção longa (2+ anos)

### 5) Regra de performance (simples)

- Se o dado muda em **sub-segundo** e não tem valor histórico de produto, **não persistir**.
- Se o dado explica o que aconteceu na corrida (replay, auditoria, analytics), **persistir**.

## Pontos de atenção atuais

- Componentes client-side devem usar `fetchLiveTiming`/API interna; não deve haver acesso direto a provedores externos de Live Timing no browser.

## Evolução recomendada

1. Incluir cache Redis para feed de race control e resumo de leaderboard.
2. Criar job de compactação diária de snapshots agregados no Postgres.
3. Aplicar política de limpeza por tabela (retention) com cron.
