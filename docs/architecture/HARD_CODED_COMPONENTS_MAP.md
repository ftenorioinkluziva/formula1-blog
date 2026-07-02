# Hardcoded Components Map

## Objetivo

Inventariar componentes com dados estáticos e definir destino de persistência (DB/API ou configuração local).

## Mapeamento

| Componente | Dado hardcoded | Destino | Status |
|---|---|---|---|
| `components/driver-profiles.tsx` | Lista de pilotos e stats | `drivers` + API `GET /[locale]/api/drivers` | **Migrado para API** |
| `components/driver-detail-modal.tsx` | Career stats de pilotos | `drivers` (colunas de carreira) | **Migrado para DB/API** |
| `components/team-profiles.tsx` | Lista de construtores | `teams` + API `GET /[locale]/api/teams` | **Migrado para API** |
| `components/team-detail-modal.tsx` | Perfil técnico das equipes | `teams` (campos full_name, chief, chassis...) | **Migrado para DB/API** |
| `components/standings-ticker.tsx` | Top 8 do campeonato | `drivers` ordenado por posição | **Migrado para API** |
| `components/standings-section.tsx` | Tabela de pilotos/construtores | APIs `GET /[locale]/api/drivers` e `GET /[locale]/api/teams` | **Migrado para API** |
| `components/hero-section.tsx` | Carrossel principal + ticker lateral | API `GET /[locale]/api/news` + `GET /[locale]/api/drivers` | **Migrado para API** |
| `components/schedule-section.tsx` | Calendário de corridas | `race_weekends` + `race_sessions` via `GET /[locale]/api/race-weekends` | **Migrado para API** |
| `components/race-detail-modal.tsx` | Sessões por corrida | `race_weekends` + `race_sessions` via `GET /[locale]/api/race-weekends` | **Migrado para API** |
| `components/multimedia-section.tsx` | Galerias e podcasts (vídeos da home descontinuados) | Tabelas `media_galleries`, `media_podcasts` + API `GET /[locale]/api/multimedia` | **Migrado para API** |
| `components/news-section.tsx` | Cards e destaques de notícias | Tabela `news_articles` + API `GET /[locale]/api/news` | **Migrado para API** |
| `components/navigation.tsx` | Links institucionais | Config local (`lib/navigation-config.ts`) | Mantém local |
| `components/site-footer.tsx` | Sessões de footer | Config local (`lib/footer-config.ts`) | Mantém local |

## APIs criadas nesta etapa

- `GET /[locale]/api/drivers`
- `GET /[locale]/api/teams`
- `GET /[locale]/api/race-weekends`
- `GET /[locale]/api/multimedia`
- `GET /[locale]/api/news`
- `GET /[locale]/api/gallery/[id]`

## Tabelas criadas/expandidas

- `drivers` (expandida com perfil + carreira)
- `teams` (nova)
- `media_galleries` (nova — campos: `cover_image_url`, `folder_key`)
- `gallery_images` (nova — FK para `media_galleries`, campos: `image_url`, `caption`, `sort_order`)
- `media_podcasts` (nova)
- `news_articles` (nova)
- `pole_videos` (nova — vídeos da aba Pole X-Ray em analytics)

## Scripts de sync de mídia (Cloudinary)

| Script | Função |
|---|---|
| `pnpm db:sync-galleries` | Varre `public/images/galleries/`, faz upload ao Cloudinary e sincroniza `media_galleries` + `gallery_images` |
| `pnpm db:migrate-cloudinary` | Migra assets existentes no banco (URLs locais → Cloudinary). Idempotente. |
| `pnpm db:sync-pole-videos` | Faz upload de `public/videos/pole_NN.mp4` para `pole_videos` |
| `pnpm db:seedimages` | Popula `gallery_images` com dados de placeholder (seed estático) |

**Storage:** Cloudinary (`cloud_name: di37e3spi`, pasta `f1blog/`). Credenciais em `.env.local`.

**Fluxo para novos assets:** para galerias, use `public/images/galleries/` + `pnpm db:sync-galleries`; para pole lap analytics, use `public/videos/pole_NN.mp4` + `pnpm db:sync-pole-videos`.

## Rotas dedicadas de artigos

- `app/[locale]/news/[id]/page.tsx` — Server Component com `generateMetadata`, substituiu modal de leitura
- Componente `NewsArticleDetail` com share buttons (WhatsApp, Telegram, Copiar link)

## Próxima iteração recomendada

1. Manter `navigation`/`footer` como configuração local, salvo novo requisito de CMS.
2. Consolidar dados de seed em domínio próprio se quiser separar de `lib/*-data.ts`.
