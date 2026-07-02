# Contributing

## Objetivo

Este documento define o fluxo padrão para contribuir no projeto com previsibilidade e baixa fricção.

## Pré-requisitos

- Node.js 20+
- pnpm
- PostgreSQL acessível via `DATABASE_URL`
- Redis acessível via `REDIS_URL`

## Setup local

1. `pnpm install`
2. criar `.env.local` com base em `.env.example`
3. `pnpm db:push`
4. `pnpm db:seed`
5. `pnpm dev`

## Fluxo de adição de mídia (imagens)

O armazenamento de mídia usa **Cloudinary** (`cloud_name: di37e3spi`, pasta `f1blog/`). A pasta `public/` serve apenas como área de staging local — os arquivos devem ser removidos após o sync confirmado.

### Nova galeria de fotos

O sync de galerias agora é feito neste repositório via `pnpm db:sync-fotos`. O comando faz upload para o Cloudinary (`f1blog/galleries/`) e sincroniza as tabelas `media_galleries` e `gallery_images`.

**Convenções:**
- O `folder_key` no banco é a chave estável da galeria. Não renomeie pastas após sync — isso quebra a chave e cria duplicatas.

### Vídeo de pole lap (analytics)

1. Coloque o arquivo `pole_NN.mp4` em `public/videos/`.
2. Execute `pnpm db:sync-pole-videos`.
3. Confirme no Analytics (aba Pole X-Ray).
4. Delete o arquivo local.

### Scripts disponíveis

| Script | Ação |
|---|---|
| `pnpm db:migrate-cloudinary` | Migra URLs locais existentes no banco para Cloudinary (idempotente) |
| `pnpm db:sync-pole-videos` | Upload de `public/videos/pole_NN.mp4` para `pole_videos` |
| `pnpm db:sync-fotos` | Sincroniza galerias de fotos locais com Cloudinary e `media_galleries`/`gallery_images` |
| `pnpm db:sync-news` | Coleta notícias das fontes externas e grava o snapshot local em `data/news-sync/latest.json` |
| `pnpm bot:telegram` | Bot Telegram de controle do pipeline |
| `pnpm db:sync-standings` | Sincroniza standings de pilotos e construtores via Jolpica-F1 API |

---

## Fluxo de atualização de standings

Após cada rodada do campeonato, sincronize os dados de classificação:

1. Execute `pnpm db:sync-standings` (usa a season atual automaticamente).
2. Para incluir podiums de uma rodada específica: `pnpm db:sync-standings 2026 3`.
3. Verifique no site que a página de Standings exibe pontuações atualizadas.

O script usa a Jolpica-F1 API e mapeia pilotos pelo campo `code` (ex: "VER") e equipes por nome (com aliases internos).

Também disponível via API: `POST /[locale]/api/sync-standings`.

---

## Fluxo de mudança

1. Atualize a **fonte única de dados de seed** quando aplicável (`scripts/seed-data/race-calendar-data.ts`).
2. Consulte o roadmap de entidades em `DB_ENTITY_ROADMAP.md` para mudanças de banco.
3. Atualize consumidores impactados (UI, seed, endpoints).
4. Rode validação mínima:
   - `pnpm db:seed`
5. Atualize documentação quando necessário.

## Convenção de commit

Use Conventional Commits:

- `feat: ...`
- `fix: ...`
- `refactor: ...`
- `docs: ...`
- `chore: ...`

Exemplos:

- `feat: sincroniza schedule e modal com calendário compartilhado`
- `fix: corrige parse de horário de sessão no seed`

## Critérios de pronto (DoD)

- Mudança implementada sem duplicação desnecessária.
- Sem erros nos arquivos alterados.
- `pnpm db:seed` executa com sucesso para mudanças de dados.
- README/guia atualizado quando o fluxo de desenvolvimento mudar.

## Pull Request

Antes de abrir PR:

- revise o checklist em `.github/pull_request_template.md`
- descreva risco, impacto e plano de rollback quando aplicável
