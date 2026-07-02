# Notas de Pesquisa - Videos

## Evidencias coletadas
- UI principal consome videos de `GET /[locale]/api/multimedia` e renderiza grid "More Videos".
- API multimedia delega para camada DB (`getMultimediaContent`) e retorna `videos`, `galleries`, `podcasts`.
- Videos da home sao carregados da tabela `media_videos` (campos `video_url`, `thumbnail_url`, `folder_key`).
- F1TV usa rotas e componentes proprios (`/api/f1tv/*`) e nao depende de `media_videos`.

## Rotinas encontradas
- Leitura para home:
	- `app/[locale]/api/multimedia/route.ts`
	- `lib/db/multimedia.ts`
	- `components/multimedia-section.tsx`
- Escrita/manutencao de videos (pipeline legado de staging local + Cloudinary):
	- `scripts/sync-videos.ts` (scan `public/videos/*`, upload, upsert em `media_videos`, delete de orfaos)
	- `scripts/migrate-to-cloudinary.ts` (migracao de urls locais para cloudinary em `media_videos`)
	- `scripts/seed-data/seed-domains.ts` + `scripts/seed-data/media-data.ts` (seed de `media_videos`)
- Rotina relacionada, mas de outro dominio (analytics pole lap):
	- `scripts/sync-pole-videos.ts` grava em `pole_videos` (nao em `media_videos`)
	- `app/[locale]/api/analytics/pole-video/route.ts`

## Dependencias
- Comandos `package.json`:
	- `db:sync-videos`
	- `db:migrate-cloudinary`
	- `db:sync-pole-videos` (separado, manter se Pole X-Ray continuar)
- Schema:
	- `lib/db/schema.ts` define `mediaVideos` e `poleVideos`
- Documentacao operacional menciona fluxo com `public/videos/` em:
	- `README.md`
	- `CONTRIBUTING.md`
	- `CLAUDE.md`
	- `docs/architecture/*`

## Duvidas
- Escopo da limpeza inclui apenas videos da home (`media_videos`) ou tambem videos de Pole Lap (`pole_videos`)?
- Desejam manter fallback YouTube externo na home ou remover grid inteiro de videos?
