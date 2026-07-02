# Pendências

- [ ] Proteger a rota /admin/news com autenticação (ex: middleware ou verificação de sessão).
# v0 Formula 1 Blog

Aplicação Next.js com foco em conteúdo e live timing de Fórmula 1.

## Setup rápido

- Instalar dependências: `pnpm install`
- Criar `.env.local` com base em `.env.example`
- Aplicar schema: `pnpm db:migrate`
- Popular dados (calendário completo): `pnpm db:seed`
- Rodar app: `pnpm dev`

## Deploy na Hetzner

Para produção com live timing via SignalR, prefira rodar a aplicação inteira em um processo persistente na VPS, e não em ambiente serverless.

Arquivos incluídos para isso:

- `Dockerfile`
- `docker-compose.hetzner.yml`
- `.env.example`

Passos mínimos:

1. Criar `.env.production` com base em `.env.example`
2. Preencher no mínimo:
   - `NEXTAUTH_URL`
   - `NEXTAUTH_SECRET`
   - `DATABASE_URL`
   - `F1TV_TOKEN`
   - `F1TV_EMAIL` e `F1TV_PASSWORD` para renovacao automatica do token F1TV
   - `LIVE_TIMING_SOURCE=signalr`
   - `SIGNALR_HUB_URL` opcional; use para apontar o SignalR para um WebSocket proxy, ex: `https://f1tv-proxy.blackboxinovacao.com.br/signalrcore`
   - `AUTO_CONNECT_ENABLED=1`
   - `AUTO_POST_ROUND_ENABLED=1` para reconciliacao automatica de sprint/race
3. Subir com `docker compose -f docker-compose.hetzner.yml up -d --build`
4. Colocar um proxy reverso na frente apontando para a porta `3000`

Observações:

- Em VPS persistente, o scheduler e a conexão SignalR permanecem vivos no mesmo processo, então o `/live-timing` funciona no modelo atual.
- Se quiser manter fallback legado, deixe `F1MV_API_URL` apontando para o endpoint remoto do MultiViewer/Hetzner, nunca para `localhost` em produção.

### Automacao pos-etapa

Com `AUTO_POST_ROUND_ENABLED=1`, a aplicacao inicia um worker persistente que:

- monitora sessoes `Sprint` e `Race` finalizadas via `session_status_events`
- espera uma janela de seguranca de 10 minutos apos `Finalised`
- apos `Sprint` finalizada e antes da `Race`, sincroniza standings/resultados e recalcula fantasy sem evoluir precos
- apos `Race` finalizada, executa o pipeline completo de `post-round`
- reprocessa a rodada por 24h se detectar mudanca real nos resultados oficiais de `Sprint` ou `Race` via hash de payload Jolpica

O estado da automacao e persistido em Redis com fallback local em memoria.

### Renovacao automatica F1TV

Quando `F1TV_EMAIL` e `F1TV_PASSWORD` estao configurados, a aplicacao inicia um worker persistente que:

- monitora `race_sessions.start_time_utc`
- encontra a proxima primeira sessao do fim de semana (`Practice 1`, `Pratice 1`, `P1` ou `FP1`)
- faz a primeira tentativa exatamente em `start_time_utc - 24h`
- se falhar, tenta novamente de hora em hora ate conseguir ou ate a sessao comecar
- quando `F1TV_PROXY_URL` esta configurado, faz a autenticacao pelo endpoint `/f1tv/auth` do proxy com o header `x-f1tv-proxy-secret`; use `F1TV_PROXY_AUTH_URL` para sobrescrever a URL exata
- ativa o token em memoria e persiste em Redis (`f1tv:token`) e em `.env.local` quando o arquivo existir
- persiste o estado por sessao em Redis para evitar renovacoes repetidas e controlar o proximo retry

Defina `F1TV_AUTO_RENEW_ENABLED=0` para desativar esse worker.

### GitHub Actions

O repositório agora inclui `.github/workflows/deploy-hetzner.yml` para deploy automático na VPS.

Secrets necessários no GitHub:

- `HETZNER_HOST` — ex: `135.181.47.220`
- `HETZNER_USER` — ex: `root`
- `HETZNER_SSH_KEY` — chave privada usada para acessar a VPS
- `HETZNER_DEPLOY_PATH` — ex: `/opt/v0-formula-1-blog/app`

Premissas no servidor:

- o diretório de deploy já existe
- `.env.production` já existe no servidor e não é sobrescrito pelo workflow
- Docker está instalado
- a rede `npm_default` do Nginx Proxy Manager existe
- o Proxy Host do NPM aponta para `f1_blog:3000`

## Fluxo de migrações (Drizzle)

### Ambiente novo (banco vazio)

1. `pnpm db:migrate`
2. `pnpm db:seed`

### Ambiente legado (banco criado via `db:push` sem histórico)

1. `pnpm db:baseline`
2. `pnpm db:migrate`
3. `pnpm db:seed` (opcional, se precisar repovoar)

Observações:

- `db:baseline` cria/atualiza `drizzle.__drizzle_migrations` com a última migração local sem reaplicar SQL antigo.
- Use `db:push` apenas para prototipação/local quando quiser sincronizar schema rapidamente sem trilha de migração.
- Para evolução controlada em equipe, prefira sempre `db:generate` + `db:migrate`.

## Scripts principais

- Desenvolvimento: `pnpm dev`
- Build: `pnpm build`
- Lint: `pnpm lint`
- Drizzle generate: `pnpm db:generate`
- Drizzle migrate: `pnpm db:migrate`
- Drizzle baseline (legado): `pnpm db:baseline`
- Drizzle push: `pnpm db:push`
- Drizzle studio: `pnpm db:studio`
- Seed completo: `pnpm db:seed`
- Sync standings (Jolpica-F1 API): `pnpm db:sync-standings [season] [round]`
- Sync vídeos de pole lap: `pnpm db:sync-pole-videos`
- Sync galerias de fotos: `pnpm db:sync-fotos`
- Sync de notícias externas para snapshot local: `pnpm db:sync-news`
- Bot Telegram: `pnpm bot:telegram`
- Migrar URLs locais para Cloudinary: `pnpm db:migrate-cloudinary`
- Seed do fantasy: `pnpm db:seed-fantasy [season] [round]`
- Simular usuários fantasy: `pnpm db:simulate-fantasy-users [season] [round] [count]`
- E2E: `pnpm test:e2e`
- E2E headed: `pnpm test:e2e:headed`

## Fantasy Pitwall

O projeto já inclui um modo fantasy por etapa em `app/[locale]/fantasy`, com lineup enxuto e score persistido.

Roster atual:

- `2` pilotos
- `1` equipe
- `1` Pit Wall Lead
- previsões da rodada

Capacidades já implementadas:

- schema fantasy completo com migração `0030_create_fantasy_core.sql`
- seed de ativos, preços e regras para a temporada 2026
- APIs de bootstrap, assets, Pit Wall Lead, draft, predictions, review, lock, result, score e leaderboard
- score persistido em `fantasy_round_scores` e breakdown auditável em `fantasy_score_items`
- leaderboard de rodada e temporada
- tela fantasy modular com cards de drivers, team, Pit Wall Lead, predictions, result e leaderboard
- suíte E2E cobrindo happy path, regra global de Pit Wall Lead, bloqueio após lock e rodada finalizada

### Regras operacionais atuais

- lock da entry ocorre no início do qualifying da rodada
- budget cap da temporada: `100`
- time hold mínimo da equipe: `3` rodadas
- sem autenticação real no MVP; identidade via `sessionKey`

### Scoring atual

O score total da etapa é composto por quatro blocos persistidos:

- pilotos
- equipe
- Pit Wall Lead
- previsões

Pit Wall Lead agora é pontuado de forma puramente team-based:

- execução de qualifying da equipe
- sharpness de qualifying da equipe
- execução agregada da corrida
- conversão em pontos
- confiabilidade
- execução do pit crew
- ganho em janela de SC/VSC

O breakdown exibido na UI é lido do backend já traduzido por label, sem reconstrução da regra no frontend.

### Simulação local de usuários fantasy

Para criar uma massa fixa de usuários simulados e recalcular uma rodada:

```bash
pnpm db:simulate-fantasy-users 2026 1 10
```

O script cria ou atualiza perfis `fantasy-sim-01` até `fantasy-sim-10`, trava as entries como se tivessem sido fechadas antes do lock, preenche previsões e recalcula o leaderboard da rodada.

Para reaproveitar a mesma coorte na rodada seguinte:

```bash
pnpm db:simulate-fantasy-users 2026 2 10
```

## Variáveis de ambiente

Obrigatórias para o fluxo completo:

- `DATABASE_URL`
- `REDIS_URL`

Cloudinary (armazenamento de mídia):

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Live Timing (MultiViewer):

- `F1MV_API_URL` — endpoint GraphQL do MultiViewer (padrão: `http://localhost:10101/api/graphql`)
  - Produção: aponte para o servidor Hetzner (`http://135.181.47.220:10101/api/graphql`)

Recomendadas:

- `REDIS_SESSION_BANNER_TTL_SECONDS` (padrão sugerido: `30`)

Observações:

- Em ambiente local, prefira `DATABASE_URL` com `sslmode=disable` se seu Postgres não aceitar SSL.
- Nunca versionar `.env.local`.

## Mídia (galerias e vídeos)

O armazenamento de mídia usa **Cloudinary** (`cloud_name: di37e3spi`, pasta `f1blog/`). A pasta `public/` serve apenas como área de staging local — os arquivos devem ser removidos após o sync confirmado.

Fluxo detalhado: ver [CONTRIBUTING.md](CONTRIBUTING.md) → "Fluxo de adição de mídia".

### Galerias de fotos

O sync de galerias agora é feito neste repositório via `pnpm db:sync-fotos`. O comando faz upload para o Cloudinary (`f1blog/galleries/`) e sincroniza as tabelas `media_galleries` e `gallery_images` automaticamente.

### Vídeos (home/multimedia)

O pipeline de ingestão de vídeos da home foi descontinuado. A seção de vídeos customizados em `media_videos` não é mais usada.

### Migração de URLs existentes

`pnpm db:migrate-cloudinary` permanece para migração de imagens (galerias) que ainda estejam com URL local.

### Pole lap videos

Estrutura esperada:
```
public/videos/
  pole_01.mp4
  pole_02.mp4
```

Fluxo:
1. Colocar `pole_NN.mp4` em `public/videos/`
2. Executar `pnpm db:sync-pole-videos`
3. Confirmar no Analytics (aba Pole X-Ray)
4. Deletar o arquivo local

Os vídeos são salvos na tabela `pole_videos` e servidos via `GET /[locale]/api/analytics/pole-video`.

## Standings (classificação de pilotos e construtores)

Os dados de standings (`points`, `position`, `wins`, `podiums`) são sincronizados a partir da **Jolpica-F1 API** (fork público do Ergast).

### Uso

```bash
pnpm db:sync-standings          # Sincroniza season atual
pnpm db:sync-standings 2026     # Especifica season
pnpm db:sync-standings 2026 3   # Sincroniza standings + podiums da round 3
```

O script mapeia pilotos por `code` (ex: "VER", "NOR") e equipes por nome (com aliases internos para diferenças como "Red Bull" → "Red Bull Racing").

Também disponível via API: `POST /[locale]/api/sync-standings` com body `{ "season": 2026, "round": 3 }`.

### Ordenação

As queries de standings ordenam por `points DESC, position ASC` — garantindo exibição correta mesmo quando o campo `position` está zerado ou ausente.

## Fonte única de dados

O calendário de corridas e sessões detalhadas é centralizado em:

- `scripts/seed-data/race-calendar-data.ts`

Consumidores atuais:

- `components/schedule-section.tsx`
- `components/race-detail-modal.tsx`
- `scripts/seed-weekend-sessions.ts`

Qualquer mudança de data/horário/tipo de sessão usada no seed deve começar nesse arquivo.

## Comportamento atual (mar/2026)

- Analytics: aba Overtakes removida (UI, API e pipeline OpenF1).
- Gap to Leader: filtros Top 5/Top 10 seguem ordem de chegada da corrida.
- Schedule: horários/sessões são exibidos no fuso do usuário a partir de timestamps UTC.
- Multimedia (vídeos): ordenação por `created_at` decrescente (mais recentes primeiro).
- Fantasy: modo Pitwall ativo com roster `2` drivers + `1` team + `1` Pit Wall Lead + predictions.
- Fantasy: Pit Wall Lead é seleção global do grid, sem filtro pelos pilotos escolhidos.
- Fantasy: scoring do Pit Wall Lead é team-based e já persiste breakdown auditável.
- Migrações aplicadas mais recentes: `0029_drop_overtakes.sql` e `0030_create_fantasy_core.sql`.

## Cache e consistência

- O endpoint do banner usa Redis com fallback para Postgres.
- O seed invalida a chave `session-banner:v1` ao final para evitar dados defasados na home.

## Troubleshooting

- `Please provide required params for Postgres driver: url ''`
	- `DATABASE_URL` não carregada no processo.
- `The server does not support SSL connections`
	- use `sslmode=disable` na `DATABASE_URL` local.
- `SASL ... client password must be a string`
	- faltou senha no usuário do Postgres; inclua na `DATABASE_URL`.
- `DATABASE_URL não definido` no seed
	- confirme `.env.local` existente e chave preenchida.
- `Can't find meta/_journal.json file` no `db:migrate`
	- confirme a pasta `drizzle/meta` no repositório e execute `pnpm db:baseline` em banco legado.

## Iteração com agents

Para manter consistência entre UI, seed e banco de dados, siga o guia:

- [AGENT_ITERATION_GUIDE.md](AGENT_ITERATION_GUIDE.md)

Esse guia define:

- fonte única de verdade para calendário/sessões;
- sequência de atualização entre componentes e scripts;
- validações mínimas por iteração;
- checklist para PR.

## Padrões de desenvolvimento

- Guia de contribuição: [CONTRIBUTING.md](CONTRIBUTING.md)
- Template de PR: [.github/pull_request_template.md](.github/pull_request_template.md)
- Convenções de editor: [.editorconfig](.editorconfig)
- Roadmap de entidades de banco: [DB_ENTITY_ROADMAP.md](DB_ENTITY_ROADMAP.md)
- Ownership de revisão: [.github/CODEOWNERS](.github/CODEOWNERS)
