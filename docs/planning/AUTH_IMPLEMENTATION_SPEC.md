# Especificacao de Autenticacao e Autorizacao

## Objetivo

Implementar autenticacao real no blog de F1 usando Better Auth, protegendo superficies administrativas, operacoes de sistema, APIs custosas e identidade persistente do fantasy.

O sistema atual mistura areas publicas, areas administrativas e comandos operacionais sem uma fronteira consistente de autorizacao. Esta especificacao define o desenho alvo, a ordem de implementacao e os criterios de pronto para fechar esse gap sem quebrar i18n, F1TV, editorial automation, live timing e fantasy.

## Estado Atual

- `proxy.ts` aplica apenas o middleware de i18n via `next-intl`.
- `app/[locale]/admin/` existe e esta documentado como nao protegido.
- `ADMIN_SECRET` protege apenas parte das operacoes administrativas do fantasy.
- `app/[locale]/api/f1tv/auth` permite ativar e persistir token F1TV sem sessao administrativa.
- Endpoints editoriais permitem criar, editar, publicar, ignorar e deletar conteudo sem autenticacao.
- Endpoints operacionais permitem iniciar/parar/deletar gravacoes, sincronizar standings e disparar jobs custosos.
- Fantasy usa `sessionKey` como identidade MVP, sem conta real de usuario.
- `better-auth` ainda nao esta instalado.

## Metas de Produto

- Exigir login para qualquer tela administrativa.
- Substituir segredos manuais no navegador por sessao autenticada com role.
- Permitir que o fantasy tenha identidade persistente por usuario.
- Proteger tokens, credenciais, pipelines custosos e operacoes destrutivas.
- Manter paginas publicas de conteudo, calendario, analytics e leaderboard acessiveis sem login.
- Preservar o roteamento com locale obrigatorio.
- Criar base extensivel para roles futuras, como editor, admin e usuario fantasy.

## Nao Metas

- Trocar a stack de banco ou abandonar Drizzle.
- Criar um CMS completo.
- Implementar multi-tenant ou organizacoes na primeira fase.
- Migrar todo historico fantasy automaticamente no primeiro deploy.
- Remover suporte temporario ao `sessionKey` enquanto a migracao de fantasy nao estiver completa.
- Exigir login para leitura publica de noticias, calendario, standings, analytics e regras do fantasy.

## Stack Alvo

### Biblioteca

Usar Better Auth como base de autenticacao.

Referencias de desenho:

- Introduction: `https://better-auth.com/docs/introduction`
- Installation: `https://better-auth.com/docs/installation`
- Next.js integration: `https://better-auth.com/docs/integrations/next`
- Drizzle adapter: `https://better-auth.com/docs/adapters/drizzle`

### Integracao Next.js

Arquivos alvo:

- `lib/auth.ts`
- `lib/auth-client.ts`
- `app/api/auth/[...all]/route.ts`
- `lib/auth/guards.ts`
- `lib/auth/roles.ts`

O handler Better Auth deve ficar fora de `app/[locale]`, em `/api/auth/[...all]`, para seguir o padrao recomendado e evitar duplicar handlers por locale.

As paginas com locale devem redirecionar para `/{locale}/sign-in` quando necessario.

### Banco

Usar adapter Drizzle/Postgres.

Como o projeto usa migracoes SQL manuais, a criacao das tabelas de auth deve seguir o fluxo local:

1. Criar `drizzle/0033_auth.sql` ou o proximo indice disponivel no momento da implementacao.
2. Registrar a migration em `drizzle/meta/_journal.json`.
3. Rodar `pnpm db:migrate`.

Nao usar `drizzle-kit generate` interativamente para introduzir a migration final.

## Modelo de Roles

### Roles iniciais

| Role | Uso |
|---|---|
| `user` | Usuario autenticado comum, dono de perfil fantasy. |
| `editor` | Pode revisar, editar e publicar conteudo editorial. |
| `admin` | Pode executar operacoes administrativas e de sistema. |

### Permissoes

| Permissao | `user` | `editor` | `admin` |
|---|---:|---:|---:|
| Ler conteudo publico | sim | sim | sim |
| Gerenciar proprio fantasy | sim | sim | sim |
| Ver admin shell | nao | sim | sim |
| Gerenciar noticias e pendentes | nao | sim | sim |
| Gerenciar galerias | nao | sim | sim |
| Gerenciar F1TV token | nao | nao | sim |
| Rodar sync/score/price/podcast/transcribe admin | nao | nao | sim |
| Iniciar/parar/deletar recording | nao | nao | sim |

### Representacao

Adicionar um campo de role na entidade de usuario do Better Auth ou uma tabela local de perfil de autorizacao, conforme a forma mais estavel suportada pelo adapter na implementacao.

Decisao preferida:

- Manter o usuario Better Auth como identidade.
- Criar tabela local `user_profiles` para metadados do app:
  - `user_id`
  - `role`
  - `display_name`
  - `created_at`
  - `updated_at`

Motivo: evita acoplar regras de produto diretamente ao schema gerado da biblioteca e facilita evoluir dados especificos do app.

## Matriz de Protecao

### Publico sem login

Continuam publicos:

- `/{locale}`
- `/{locale}/news`
- `/{locale}/news/{id}`
- `/{locale}/drivers`
- `/{locale}/teams`
- `/{locale}/race-weekends`
- `/{locale}/analytics`
- `/{locale}/api-docs`
- `/{locale}/fantasy/rules`
- `/{locale}/api/drivers`
- `/{locale}/api/teams`
- `/{locale}/api/race-weekends`
- `/{locale}/api/news` `GET`
- `/{locale}/api/news/{id}` `GET`, se existir
- `/{locale}/api/analytics/*` `GET`
- `/{locale}/api/session-*` `GET`
- `/{locale}/api/lap-summaries/*` `GET`
- `/{locale}/api/race-control-messages/*` `GET`
- `/{locale}/api/gallery/*` `GET`
- `/{locale}/api/gallery-images` `GET`
- `/{locale}/api/multimedia` `GET`
- `/{locale}/api/session-banner` `GET`

### Autenticado como user

Exigir login:

- `/{locale}/fantasy`
- `/{locale}/api/fantasy/profile` mutacoes
- `/{locale}/api/fantasy/draft` mutacoes
- `/{locale}/api/fantasy/draft/lineup` mutacoes
- `/{locale}/api/fantasy/draft/predictions` mutacoes
- `/{locale}/api/fantasy/lock`
- `/{locale}/api/fantasy/review`
- `/{locale}/api/fantasy/result`, quando retornar resultado especifico do usuario

Leituras de leaderboard, assets e regras podem seguir publicas se nao vazarem dados privados.

### Editor ou admin

Exigir `editor` ou `admin`:

- `/{locale}/admin/news`
- `/{locale}/admin/multimedia/galleries`
- `/{locale}/api/pending-articles`
- `/{locale}/api/pending-articles/{id}`
- `/{locale}/api/news` `POST`
- `/{locale}/api/news/{id}` `PUT`
- `/{locale}/api/news/{id}` `DELETE`
- `/{locale}/api/admin/galleries`
- `/{locale}/api/admin/galleries/{id}`
- `/{locale}/api/admin/galleries/{id}/images`
- `/{locale}/api/admin/galleries/{id}/images/{imageId}`

### Admin only

Exigir `admin`:

- `/{locale}/admin/f1tv`
- `/{locale}/admin/fantasy`
- `/{locale}/api/f1tv/auth` `POST`
- `/{locale}/api/sync-standings` `POST`
- `/{locale}/api/fantasy/score` `POST`
- `/{locale}/api/fantasy/evolve-prices` `POST`
- `/{locale}/api/fantasy/post-round` `POST`
- `/{locale}/api/fantasy/auto-score` `POST`
- `/{locale}/api/recording` `POST`
- `/{locale}/api/recording/{sessionKey}` `DELETE`
- `/{locale}/api/podcast/generate` `POST`
- `/{locale}/api/transcribe` `POST`

### F1TV playback

Decisao de produto:

- F1TV auth/token management e admin status sao `admin` only.
- Endpoints que retornam stream, entitlement ou license devem exigir no minimo usuario autenticado.
- Se o app for estritamente local e privado, pode ser aceitavel `admin` only para toda a superficie F1TV.

Recomendacao inicial:

- `/{locale}/live`, `/{locale}/watch`, `/{locale}/watch/live`, `/{locale}/replay` exigem login.
- `/{locale}/api/f1tv/streams`, `entitlement`, `license`, `content` exigem login.
- `/{locale}/api/f1tv/status` pode retornar apenas status sanitizado publicamente, sem detalhes de conta, ou exigir admin para resposta completa.

### Recording replay

- Listagem de recordings: autenticado.
- Conteudo NDJSON de recording: autenticado.
- Delete/start/stop: admin.
- Eventos extraidos de recording: autenticado se nao houver dados sensiveis; admin se incluir team radio ou payload bruto.

## Guardas de Servidor

Criar helpers centrais em `lib/auth/guards.ts`:

- `getCurrentSession()`
- `requireUser()`
- `requireRole(role)`
- `requireAnyRole(roles)`
- `requireAdmin()`
- `forbiddenResponse()`
- `unauthorizedResponse()`

Esses helpers devem ser usados em Route Handlers e Server Components.

Exemplo conceitual:

```ts
const session = await requireAdmin()
if (session instanceof Response) return session
```

Para paginas Server Components:

```ts
await requireAdminPage(locale)
```

## Proxy e i18n

O `proxy.ts` precisa continuar chamando o middleware de `next-intl`.

Requisito:

- Preservar locale prefix sempre.
- Ignorar `_next`, arquivos estaticos, `/api/auth/*` e assets.
- Para rotas protegidas, validar cookie de sessao ou redirecionar para `/{locale}/sign-in?next=...`.
- Para APIs protegidas, retornar `401` ou `403` JSON, nao redirect HTML.

Melhor abordagem:

1. Usar o proxy para uma barreira rapida por cookie em paginas protegidas.
2. Revalidar sessao e role dentro das paginas e route handlers.

O proxy nao deve ser a unica camada de seguranca.

## Telas de Auth

Criar:

- `app/[locale]/sign-in/page.tsx`
- `app/[locale]/sign-up/page.tsx`, se cadastro publico for permitido
- `app/[locale]/account/page.tsx`

Decisao inicial recomendada:

- Habilitar email/password.
- Cadastro publico pode ficar desativado por env em producao.
- Criar primeiro admin via script ou seed controlado.

Variaveis:

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `AUTH_PUBLIC_SIGNUP_ENABLED`
- `AUTH_FIRST_ADMIN_EMAIL`

## Seed de Admin

Criar script:

- `scripts/seed-admin-user.ts`

Responsabilidades:

- Criar usuario admin inicial ou promover usuario existente.
- Nao imprimir senha em logs.
- Exigir email explicito por argumento/env.
- Ser idempotente.

Comando sugerido:

```bash
pnpm exec tsx scripts/seed-admin-user.ts admin@example.com
```

## Migracao do Fantasy

### Estado atual

`fantasy_profiles.session_key` e a identidade MVP.

### Estado alvo

Adicionar vinculo opcional:

- `fantasy_profiles.user_id`

Regras:

- Novos usuarios autenticados devem ter perfil fantasy vinculado a `user_id`.
- Durante transicao, `sessionKey` continua aceito apenas para perfis legados.
- Quando usuario logado acessa um perfil legado, oferecer claim/migracao controlada.
- Mutacoes fantasy devem validar ownership:
  - usuario comum so altera o proprio perfil/entry
  - admin pode inspecionar e operar suporte

### Criterio de corte

Depois da migracao:

- `sessionKey` nao deve autorizar mutacoes sozinho.
- Pode permanecer como identificador tecnico ou fallback de leitura.

## Substituicao de ADMIN_SECRET

O `ADMIN_SECRET` deve ser removido do fluxo de UI.

Fase transitoria:

- Endpoints fantasy admin aceitam sessao admin.
- `ADMIN_SECRET` pode ser mantido apenas como fallback temporario para jobs internos, com aviso de deprecated.

Estado final:

- UI admin nao pede chave secreta.
- Route handlers usam `requireAdmin()`.
- Jobs internos usam uma das opcoes:
  - execucao local via script
  - cron com segredo dedicado de machine-to-machine
  - sessao admin nao interativa somente se houver desenho explicito

## Rate Limit e Abuso

Better Auth tem rate limiter embutido para auth. Alem disso, adicionar protecao local para:

- sign-in
- sign-up
- `transcribe`
- `podcast/generate`
- `f1tv/streams`
- `f1tv/license`

Recomendacao:

- Usar Redis quando `REDIS_URL` estiver disponivel.
- Fallback em memoria apenas para dev.
- Chave por usuario autenticado e IP.

## Auditoria

Adicionar tabela simples `admin_audit_log`:

- `id`
- `actor_user_id`
- `actor_role`
- `action`
- `target_type`
- `target_id`
- `metadata_json`
- `created_at`

Eventos minimos:

- login admin bem-sucedido
- publish pending article
- update/delete news
- create/update/delete gallery
- F1TV token activation
- recording start/stop/delete
- sync standings
- fantasy score/evolve/post-round
- podcast generation
- transcribe request

## Plano de Implementacao

### Fase 1: Fundacao de auth

Entregas:

- Instalar `better-auth`.
- Criar `lib/auth.ts`.
- Criar `lib/auth-client.ts`.
- Criar `/api/auth/[...all]`.
- Criar migration manual de tabelas auth.
- Criar `user_profiles` com role.
- Criar paginas de sign-in e account.
- Criar seed de admin.

Criterios de aceite:

- Usuario consegue fazer login e logout.
- Sessao aparece no servidor via helper central.
- Admin inicial pode ser criado de forma idempotente.
- `pnpm build` passa.

### Fase 2: Proteger admin e APIs editoriais

Entregas:

- Proteger `/{locale}/admin/*`.
- Proteger noticias, pending articles e galleries.
- Adicionar audit log para acoes editoriais.
- Remover qualquer criacao/edicao/delecao publica de conteudo.

Criterios de aceite:

- Usuario anonimo recebe redirect em pagina admin.
- Usuario anonimo recebe 401/403 em API mutavel.
- `editor` consegue publicar/editar noticias.
- `user` comum nao consegue acessar admin.

### Fase 3: Proteger operacoes de sistema e F1TV

Entregas:

- Proteger `/admin/f1tv` e `/api/f1tv/auth`.
- Proteger sync standings, recording, podcast e transcribe.
- Definir resposta sanitizada de `/api/f1tv/status`.
- Aplicar auth nos endpoints de playback F1TV conforme decisao final.

Criterios de aceite:

- Token F1TV nao pode ser ativado sem admin.
- Jobs custosos nao podem ser disparados anonimamente.
- Recording nao pode ser deletado anonimamente.

### Fase 4: Migrar fantasy para usuario autenticado

Entregas:

- Adicionar `user_id` em `fantasy_profiles`.
- Vincular novos profiles ao usuario logado.
- Validar ownership nas rotas de mutacao.
- Manter transicao controlada para `sessionKey`.
- Atualizar E2E do fantasy.

Criterios de aceite:

- Usuario logado mantem lineup entre dispositivos.
- Outro usuario nao consegue alterar lineup alheia.
- Profiles legados continuam legiveis.

### Fase 5: Limpeza e hardening

Entregas:

- Remover dependencia de `ADMIN_SECRET` da UI.
- Adicionar rate limit em endpoints sensiveis.
- Cobrir testes de auth negativa.
- Atualizar `.env.example`, README e AGENTS.md.

Criterios de aceite:

- Nenhum endpoint mutavel sensivel fica sem guarda.
- Documentacao operacional reflete o fluxo real.
- Testes cobrem anonimo, user, editor e admin.

## Testes

### Unitarios

- `requireUser()` retorna 401 sem sessao.
- `requireAdmin()` retorna 403 para `user`.
- `requireAnyRole(["editor", "admin"])` aceita editor.
- Role default de novo usuario e `user`.

### Integracao API

Cobrir:

- `POST /api/news` anonimo -> 401/403.
- `PUT /api/news/{id}` user -> 403.
- `POST /api/pending-articles/{id}` editor -> 200.
- `POST /api/f1tv/auth` editor -> 403.
- `POST /api/f1tv/auth` admin -> 200 com payload valido.
- `POST /api/fantasy/score` user -> 403.
- `POST /api/transcribe` anonimo -> 401/403.

### E2E

Cobrir:

- Acesso anonimo a `/pt/admin/news` redireciona para `/pt/sign-in`.
- Admin faz login e acessa `/pt/admin/news`.
- Editor publica artigo pendente.
- User comum nao ve admin.
- User fantasy autenticado cria lineup.
- Outro user nao altera lineup do primeiro.

## Variaveis de Ambiente

Adicionar a `.env.example`:

```bash
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
AUTH_PUBLIC_SIGNUP_ENABLED=0
AUTH_FIRST_ADMIN_EMAIL=
```

Manter:

```bash
ADMIN_SECRET=
```

apenas enquanto houver fallback transitorio documentado.

## Riscos e Decisoes Pendentes

### Cadastro publico

Decisao pendente: permitir sign-up publico ou somente convite/admin seed.

Recomendacao: iniciar fechado, com admin seed, ate as regras de abuso e rate limit estarem validadas.

### F1TV publico vs autenticado

Decisao pendente: se playback F1TV e recurso privado local/admin ou recurso para usuarios logados.

Recomendacao: exigir login para playback e admin para token management.

### Social login

Decisao pendente: incluir Google/GitHub login.

Recomendacao: comecar com email/password para reduzir dependencias externas. Social login pode entrar depois.

### SessionKey legado

Risco: cortar `sessionKey` cedo demais quebra usuarios/testes existentes.

Recomendacao: migracao em duas etapas, com compatibilidade temporaria e testes E2E.

## Definition of Done

- Better Auth instalado e configurado.
- Migration manual de auth aplicada.
- Admin inicial idempotente.
- Todas as paginas `/{locale}/admin/*` exigem role adequada.
- Todas as APIs mutaveis sensiveis exigem role adequada.
- F1TV token management exige admin.
- Endpoints custosos exigem admin ou usuario autenticado conforme matriz.
- Fantasy tem caminho de identidade autenticada.
- Testes cobrem acesso anonimo, user, editor e admin.
- `.env.example`, README e AGENTS.md atualizados.
- `pnpm build` passa.
