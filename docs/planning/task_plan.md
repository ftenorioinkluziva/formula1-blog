# Plano de Trabalho - Remocao de videos do servidor

## Objetivo
Mapear todas as rotinas relacionadas ao armazenamento/gestao de videos no servidor e propor plano de limpeza do codebase para migrar para uma estrategia sem armazenamento local/servidor proprio.

## Fases
- [x] Fase 1: Inventario tecnico dos pontos de entrada (UI, API, DB, scripts, storage)
- [x] Fase 2: Mapa de dependencias e impacto
- [x] Fase 3: Plano incremental de desativacao/remocao
- [x] Fase 4: Checklist de validacao e rollback

## Decisoes
- Limpeza deve priorizar `media_videos` (home/multimedia) e manter `pole_videos` fora do escopo inicial para evitar regressao no Pole X-Ray.
- Decomissionar em ondas para reduzir risco de quebra operacional.

## Riscos registrados
- Se remover `media_videos` direto, `GET /api/multimedia` pode quebrar a home.
- Se remover scripts sem atualizar docs/comandos, fluxo operacional fica inconsistente.
- `sync-pole-videos` compartilha pasta `public/videos/`; separar escopo antes de apagar referencias globais.

## Plano incremental (proposto)
1. Onda 1 - Desativacao funcional da home videos:
	- Status: concluida
	- Filtrar/zerar retorno de videos em `getMultimediaContent` para esconder "More Videos".
	- Manter API e tipos para nao quebrar contrato.
2. Onda 2 - Remocao de pipeline de gestao de `media_videos`:
	- Status: concluida
	- Remover script `scripts/sync-videos.ts` e comando `db:sync-videos`.
	- Remover seed de `media_videos`.
	- Opcional: manter tabela temporariamente sem uso.
3. Onda 3 - Limpeza estrutural:
	- Status: concluida
	- Remover tabela/campos `media_videos` via migration manual.
	- Limpar tipos e queries em `lib/db/multimedia.ts` e `lib/db/schema.ts`.
4. Onda 4 - Documentacao e operacao:
	- Status: concluida
	- Atualizar `README.md`, `CONTRIBUTING.md`, `CLAUDE.md` e docs de arquitetura.
	- Atualizar runbooks/commands para novo fluxo sem videos locais.

## Checklist de validacao
1. Home abre sem erros com `MultimediaSection` e sem bloco "More Videos".
2. `GET /[locale]/api/multimedia` continua retornando JSON valido (`videos`, `galleries`, `podcasts`).
3. Tabs de photos/podcasts continuam funcionais.
4. Fluxo F1TV (`/api/f1tv/*`) continua intacto.
5. Pole X-Ray continua carregando video via `pole_videos` (se mantido em escopo separado).
6. `pnpm build` e `pnpm lint` sem regressao.

## Rollback
1. Reverter commits da onda corrente.
2. Restaurar comando removido no `package.json` (quando aplicavel).
3. Reaplicar migration reversa se a tabela `media_videos` ja tiver sido removida.
