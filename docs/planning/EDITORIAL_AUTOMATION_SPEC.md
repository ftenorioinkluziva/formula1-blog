# Especificacao de Automacao Editorial

## Objetivo

Definir um sistema editorial de nivel de producao para o blog de F1, capaz de transformar dados estruturados de corrida e noticias recentes em artigos publicaveis com angulo claro, checagem factual, etapas de revisao e automacao controlada.

Esta especificacao substitui o fluxo atual de passo unico:

`/topic -> prompt -> pending article`

por um pipeline de redacao especializado.

## Problema Atual

O fluxo atual de geracao de topicos e artigos e fraco para um blog especializado em F1 porque tenta resolver tarefas editoriais diferentes em uma unica chamada de modelo:

1. entender a pauta
2. descobrir qual evento e qual sessao sao relevantes
3. selecionar as fontes corretas
4. definir o angulo editorial
5. escrever o texto
6. validar se o texto esta coerente com os fatos

Esse desenho falha quando:

- o topico e ambiguo
- existem multiplas sessoes para o mesmo GP
- contexto pre-corrida e pos-corrida entram no mesmo prompt
- o artigo precisa seguir uma editoria especifica
- o texto precisa ser validado contra dados estruturados do banco
- a fila de publicacao precisa de rastreabilidade

O resultado tende a ser:

- artigos genericos
- angulo errado
- mistura de sprint, quali e corrida
- uso fraco das fontes locais
- selecao ruim de imagem
- pouca confianca para automacao

## Metas de Produto

- Produzir artigos com cara de redacao especializada em F1.
- Fazer os dados estruturados locais serem a fonte primaria quando o artigo for orientado a evento.
- Separar responsabilidades editoriais: pauta, apuracao, escrita, revisao e publicacao.
- Preservar multiplas editorias e estilos de texto.
- Suportar fluxo com revisao humana e, depois, automacao seletiva.
- Garantir observabilidade: cada artigo deve ser rastreavel ate as fontes e decisoes que o geraram.
- Reaproveitar a rota existente `/admin/news` como superficie unica de gerenciamento editorial.
- Preparar o modelo de dados para multiplos idiomas desde a fundacao, ainda que a fase 1 gere apenas em portugues.

## Nao Metas

- Substituir um CMS completo.
- Criar pipeline multilanguage na primeira fase.
- Habilitar publicacao totalmente autonoma para todos os tipos de conteudo.
- Gerar cobertura live minuto a minuto na primeira iteracao.
- Criar uma nova rota administrativa paralela para o mesmo dominio editorial.

## Modelo Editorial

O sistema deve operar como uma pequena redacao com mesas editoriais especializadas.

### Editorias

- `Noticias`
  Cobertura factual: anuncios, confirmacoes, punicoes, resultados e fatos oficiais.
  Subtipos fortes nesta mesa: `race_result`, `qualifying_result`, `sprint_result` e `daily_news_roundup`.

- `Raio-X Tecnico`
  Analise de engenharia, pneus, acerto, ritmo, stints, telemetria e explicacao tecnica.

- `O Debate na Pista`
  Estrategia, decisoes de equipe, drama esportivo e momentos-chave da corrida.

- `Giro pelo Paddock`
  Cobertura ampla do grid, varias equipes, multiplos assuntos em formato mais agil.

- `Preview`
  Conteudo pre-sessao ou pre-fim de semana quando ainda nao ha resultado oficial.

### Principios Editoriais

- Todo artigo orientado a evento deve estar preso a um fim de semana e, se aplicavel, a uma sessao especifica.
- Fatos estruturados do banco tem prioridade sobre contexto narrativo externo.
- O titulo deve refletir o angulo realmente escolhido pela camada de pauta.
- Cada editoria deve ter regras, restricoes, exemplos e anti-padroes proprios.
- O sistema deve preferir incompletude a inventar fatos.

## Fluxo Editorial Proposto

### Pipeline de ponta a ponta

1. Intake
   Entrada via scheduler, `/topic`, painel admin, automacao pos-sessao ou `sync-news`.

2. Classificacao de pauta
   Determina tipo do artigo, GP, round, sessao, editoria, urgencia e elegibilidade para automacao.

3. Montagem do pacote de fontes
   Reune dados estruturados e contexto narrativo relevante.

4. Escolha do angulo
   Define a tese do artigo.

5. Geracao do rascunho
   Usa template forte da editoria escolhida.

6. Fact-check
   Verifica o rascunho contra o pacote de fontes.

7. Copy edit
   Melhora titulo, lead, fluidez e organizacao sem alterar fatos.

8. Fila de revisao
   Salva como pendente com score, avisos e metadados.

9. Publicacao
   Manual ou automatica, conforme tipo e confianca.

## Classificacao de Pauta

A classificacao precisa transformar uma entrada livre em uma assignment estavel.

### Tipos iniciais de assignment

- `race_result`
- `qualifying_result`
- `sprint_result`
- `race_preview`
- `weekend_preview`
- `technical_analysis`
- `strategy_analysis`
- `paddock_roundup`
- `daily_news_roundup`
- `topic_feature`

### Entradas

- texto do topico
- metadados de sessoes encerradas
- metadados do fim de semana
- noticias recentes relacionadas
- disponibilidade de fatos no banco

### Saidas

- `assignmentType`
- `editorialDesk`
- `locale`
- `season`
- `round`
- `sessionId`
- `sessionType`
- `topicCanonical`
- `confidence`
- `blockingReason | null`

### Regras iniciais

- Se o topico contiver semantica de resultado e existir sessao compativel com dados oficiais disponiveis, classificar como resultado.
- Se o topico citar um GP mas ainda nao houver resultado oficial, cair para `race_preview` ou `weekend_preview`.
- Se o topico for analitico e houver dados de sessao suficientes, permitir `technical_analysis` ou `strategy_analysis`.
- Se o topico for amplo e multitematico, usar `daily_news_roundup` ou `paddock_roundup`.
- `Resultado GP` nao deve ser uma `editorialDesk` propria. Deve ser `editorialDesk = Noticias`, `assignmentType = race_result` e template `resultado-gp`.
- O mesmo vale para qualifying e sprint: mesa `Noticias`, assignment type especifico e template especializado.

## Pacote de Fontes

O pacote de fontes e o contrato factual entre apuracao e escrita.

### Regras

- Deve ser JSON estruturado, nao um blob textual unico.
- Deve declarar quais campos sao autoritativos.
- Deve separar fatos duros de contexto narrativo.

### Secoes do pacote

- `assignment`
  Metadados da pauta.

- `event`
  GP, round, sessao, horario, naming oficial.

- `officialResults`
  Vencedor, podio, top 10, grid, voltas, status, pontos.

- `sportingContext`
  Classificacao do campeonato, implicacoes esportivas, DNFs, punicoes, safety car, VSC.

- `performanceContext`
  Ritmo, quali deltas, pit stops, stints, compostos, clima, gaps quando disponiveis.

- `recentNews`
  Noticias recentes relevantes para a pauta.

- `mediaContext`
  Imagens candidatas relacionadas ao evento e a sessao.
  Para o pipeline de topics, `mediaContext` deve ser image-only.
  Nao incluir videos nem ativos genericos nessa etapa.
  Cada imagem candidata deve carregar sinais de relevancia baseados em:
  - nome do arquivo
  - galeria de origem
  - sessao associada
  - evento/GP associado

- `coverageContext`
  Artigos publicados e pendentes relacionados, para dedupe e separacao de angulo.

- `sourceWarnings`
  Sinais de falta de dado, joins de baixa confianca, sessao stale ou fontes incompletas.

### Ordem de autoridade

1. fatos estruturados locais do banco
2. noticias sincronizadas em `data/news-sync/latest.json`
3. artigos publicados apenas como pano de fundo
4. inferencia do modelo apenas quando rotulada como interpretacao

## Camada de Escrita

O modelo nao deve descobrir fatos. Ele deve transformar um pacote de fontes preparado em texto editorial.

### Templates por editoria

Criar templates dedicados em um dominio novo, por exemplo:

- `lib/editorial/templates/noticias.ts`
- `lib/editorial/templates/resultado-gp.ts`
- `lib/editorial/templates/resultado-qualifying.ts`
- `lib/editorial/templates/raio-x-tecnico.ts`
- `lib/editorial/templates/debate-na-pista.ts`
- `lib/editorial/templates/giro-pelo-paddock.ts`
- `lib/editorial/templates/preview.ts`

Cada template deve definir:

- persona
- tom
- claims permitidos
- claims proibidos
- schema de saida
- regras de titulo
- regras de excerpt
- estrutura do body
- exemplos e anti-padroes

### Template `Resultado GP`

O template generico de `Noticias` nao e suficiente para cobertura de resultado.
`Resultado GP` e um template/subtipo forte dentro da mesa `Noticias`, nao uma mesa editorial separada.

Estrutura minima:

- titulo ancorado no vencedor ou no angulo dominante
- excerpt com vencedor + podio + principal consequencia
- secoes do body:
  - o que aconteceu
  - podio e destaques imediatos
  - top 10 / principais movimentos
  - impacto no campeonato

### Estrategia de chamadas ao modelo

- uma chamada para classificar a pauta
- uma chamada opcional para selecionar angulo
- uma chamada para gerar o rascunho
- uma chamada para fact-check
- uma chamada para copy edit so depois de passar no fact-check

## Fact-Check

Fact-check deve ser etapa bloqueante para automacao.

### Validacoes obrigatorias

- titulo cita o vencedor correto
- excerpt bate com o podio real
- nao mistura sprint, qualifying e corrida
- nao afirma estrategia de pneus sem dado de stint/pit suficiente
- nao usa quotes sem fonte
- nao usa imagem sem relacao com o evento
- nao contradiz standings, pontos ou top 10

### Saida do fact-check

- `pass | fail`
- `blockingIssues[]`
- `warnings[]`
- `confidenceScore`

### Regras de automacao

- `race_result`, `qualifying_result` e `sprint_result` precisam passar no fact-check antes de qualquer elegibilidade para auto-publish.
- `technical_analysis` e `strategy_analysis` devem ir primeiro para revisao manual.
- `topic_feature` nao deve auto-publicar na fase 1.
- Rascunhos que falharem no fact-check devem ser persistidos em `pending_articles` com `review_status = failed`.
- Rascunhos com `review_status = failed` nao podem ser publicados automaticamente.
- O editor humano deve conseguir visualizar, editar e aprovar por override no `/admin/news`.
- O override deve ser explicito e auditavel, com motivo, data e operador quando houver identidade disponivel.

## Copy Edit

Copy edit deve rodar apenas depois de `fact_check = pass` no fluxo automatico.

Motivo:

- evita polir texto factual errado
- reduz custo em rascunhos que serao bloqueados
- mantem o fact-check como portao real antes de refinamento editorial

Quando o fact-check falhar, o copy edit fica disponivel apenas depois de uma acao humana:

- editor corrige o rascunho e reexecuta fact-check
- editor aprova por override e solicita copy edit manual

## Dedupe e Controle de Cobertura

O projeto antigo tinha dedupe explicito contra artigos publicados. O novo sistema precisa restaurar isso de forma estruturada.

### Objetivos

- evitar gerar duas vezes a mesma cobertura de evento
- evitar repetir o mesmo angulo para o mesmo GP/sessao
- permitir artigos complementares sobre o mesmo evento

### Chaves de cobertura

- `(season, round, sessionId, assignmentType)` para cobertura factual dura
- `(season, round, editorialDesk, angleHash)` para analises e comentarios
- similaridade semantica contra `pending_articles` e `news_articles`

### Resultado do dedupe

- `duplicate_exact`
- `duplicate_angle`
- `related_but_allowed`
- `new_assignment`

## Selecao de Midia

A imagem do artigo nao deve ser aleatoria quando existir imagem relacionada.

Para topics gerados, o pipeline deve usar somente imagens e escolher a melhor candidata a partir de matching semantico e contextual.

### Regras de selecao

- primeira escolha: imagem cuja galeria e metadados apontem para a mesma sessao
- segunda escolha: imagem do mesmo GP/evento
- terceira escolha: imagem cujo nome de arquivo combine com pilotos, equipes ou assunto dominante do texto
- quarta escolha: imagem associada ao piloto, equipe ou momento principal da pauta
- ultima escolha: imagem generica segura do GP, imagem editorial neutra ou imagem padrao do blog

### Sinais de relevancia de imagem

Cada candidata deve receber score com base em:

- correspondencia entre nome do arquivo e entidades do artigo
- correspondencia entre galeria e GP/evento
- correspondencia entre galeria e sessao (`Race`, `Qualifying`, `Sprint`, etc.)
- recencia da galeria
- presenca de piloto, equipe ou palavra-chave dominante da pauta

### Contrato de implementacao

`mediaContext` deve expor, no minimo:

- `imageUrl`
- `fileName`
- `galleryTitle`
- `folderKey`
- `relatedSeason`
- `relatedRound`
- `relatedSessionType | null`
- `matchSignals[]`
- `relevanceScore`

### Evolucao futura

Persistir o motivo da escolha da imagem para a revisao humana.
O fallback nunca deve escolher uma imagem aleatoria irrestrita, para evitar associar piloto/equipe errados a uma noticia sensivel.

## Fila de Revisao

`pending_articles` deve deixar de ser apenas um blob e virar item editorial rastreavel.

Toda a operacao editorial proposta nesta especificacao deve acontecer sobre a rota ja existente `/admin/news`.
Nao deve ser criada uma nova rota administrativa do mesmo assunto, como `/admin/editorial`, `/admin/content` ou equivalente, enquanto `/admin/news` puder ser evoluida.

### Metadados desejados no pendente

- `assignmentType`
- `editorialDesk`
- `season`
- `round`
- `sessionId`
- `topicCanonical`
- `sourcePacketId`
- `reviewStatus`
- `confidenceScore`
- `blockingIssues`
- `warnings`
- `dedupeStatus`
- `imageSelectionReason`

### Necessidades do `/admin/news`

O painel deve exibir:

- tipo de artigo e editoria
- GP/sessao relacionada
- resumo das fontes usadas
- avisos factuais
- status de dedupe
- motivo da imagem escolhida
- badge de confianca e badge de revisao

### Diretriz de UX

- `/admin/news` deve concentrar o gerenciamento de pendentes, revisao, publicacao e rastreabilidade editorial.
- A evolucao deve acontecer por expansao da tela atual, seus tabs e seus detalhes, sem fragmentar o fluxo em uma nova rota administrativa para o mesmo trabalho.

## Mudancas de Dados Propostas

### Novas tabelas

#### `editorial_assignments`

- `id`
- `source` (`scheduler`, `telegram-topic`, `manual-admin`, `post-round`, `news-roundup`)
- `locale` (`pt` na fase 1)
- `raw_input`
- `topic_canonical`
- `assignment_type`
- `editorial_desk`
- `season`
- `round`
- `session_id`
- `status` (`new`, `classified`, `sourced`, `drafted`, `review_failed`, `pending_review`, `published`, `ignored`)
- `confidence_score`
- `scheduled_for`
- `next_attempt_at`
- `attempt_count`
- `last_error`
- `locked_at`
- `locked_by`
- `completed_at`
- `source_event_key`
- `news_article_id`
- `created_at`
- `updated_at`

#### `editorial_source_packets`

- `id`
- `assignment_id`
- `locale`
- `packet_json` (`jsonb`)
- `packet_hash`
- `source_summary`
- `created_at`

O source packet deve ser persistido para todo artigo gerado pelo pipeline editorial, seja origem automatica, Telegram ou admin manual.
Artigos legados ou inseridos fora do pipeline nao precisam ser retropreenchidos.

#### `editorial_reviews`

- `id`
- `assignment_id`
- `pending_article_id`
- `review_type` (`fact_check`, `copy_edit`, `dedupe`)
- `status` (`pass`, `fail`, `warn`)
- `score`
- `issues_json`
- `created_at`

#### `article_source_links`

- `id`
- `pending_article_id`
- `source_type` (`db_result`, `news_sync`, `published_article`, `gallery`)
- `source_ref`
- `source_label`
- `created_at`

### Extensoes em `pending_articles`

Adicionar colunas nullable:

- `locale`
- `assignment_type`
- `editorial_desk`
- `season`
- `round`
- `session_id`
- `review_status`
- `confidence_score`
- `source_packet_id`
- `news_article_id`
- `override_reason`
- `override_at`
- `override_by`

### Extensoes em `news_articles`

Adicionar:

- `locale` com default `pt` e `not null`

O dedupe e os filtros administrativos devem considerar `locale` para evitar misturar cobertura em idiomas diferentes.

## Modulos Propostos

Criar um dominio novo, por exemplo:

- `lib/editorial/assignment-classifier.ts`
- `lib/editorial/source-packet-builder.ts`
- `lib/editorial/sources/race-result-source.ts`
- `lib/editorial/sources/session-performance-source.ts`
- `lib/editorial/sources/recent-news-source.ts`
- `lib/editorial/sources/media-source.ts`
- `lib/editorial/dedupe.ts`
- `lib/editorial/angle-selector.ts`
- `lib/editorial/writer.ts`
- `lib/editorial/fact-checker.ts`
- `lib/editorial/copy-editor.ts`
- `lib/editorial/pipeline.ts`
- `lib/editorial/templates/*`

### Pontos de integracao

- `scripts/topic-article.ts`
  Deve virar um wrapper fino do pipeline editorial.

- `scripts/session-scheduler.ts`
  Deve parar de chamar diretamente `createTopicPendingArticle(topicName(session))` e passar a criar assignments por tipo de evento.
  O controle editorial de agendamento, retentativas e mensagens de erro deve sair de `.cache/f1blog-session-scheduler.json` e ir para as colunas operacionais de `editorial_assignments`.
  Jobs que nao sao editoriais, como scraping/sync de imagens, nao devem ser modelados como `editorial_assignments`; se tambem precisarem sair do arquivo de cache, devem usar uma tabela propria (`media_sync_jobs` ou `scheduler_jobs`).

- `scripts/run-workers.ts`
  Deve orquestrar jobs editoriais separados por classe de conteudo.

- `/admin/news`
  Deve ler e exibir os novos metadados editoriais e absorver o fluxo de revisao proposto.

## Estrategia de Automacao

Automacao deve ser seletiva por tipo de conteudo.

### Telegram `/topic`

O comando `/topic` deve criar uma `editorial_assignment` e responder imediatamente com status e ID da pauta.

Comportamento recomendado:

- resposta imediata: assignment criada, tipo preliminar e status
- processamento assincrono pelo worker editorial
- nova mensagem ao operador quando houver rascunho pendente ou falha revisavel
- modo sincronico apenas como opcao explicita de diagnostico, nao como padrao

Motivo: a geracao completa pode levar 15 a 30 segundos e ainda passar por fact-check, dedupe e selecao de imagem.

### Fase 1

- Criar assignments automaticamente para:
  - resultado de corrida
  - resultado de qualifying
  - resultado de sprint
  - roundup diario de noticias apos `sync-news`

- Salvar apenas como pendente.
- Nada de auto-publish amplo.

### Fase 2

- Permitir auto-publish apenas para:
  - `race_result`
  - `qualifying_result`
  - `sprint_result`

Condicoes:

- fact-check `pass`
- confidence score acima do threshold
- sem conflito de dedupe
- imagem relacionada encontrada ou fallback aceitavel

### Fase 3

- Avaliar auto-publish para roundup diario com threshold mais rigido e hold window configuravel.

## Plano de Rollout

### Fase A - Fundacao

- introduzir assignment e source packet
- restaurar templates fortes por editoria
- manter armazenamento atual em `pending_articles`

### Fase B - Cobertura de resultados

- implementar `race_result`, `qualifying_result`, `sprint_result`
- adicionar fact-checker
- adicionar selecao contextual de imagem

### Fase C - Roundups e especializacao

- implementar `daily_news_roundup`, `paddock_roundup`, `preview`
- restaurar dedupe contra publicados e pendentes

### Fase D - UX editorial e automacao controlada

- expandir `/admin/news`
- mostrar fontes e badges de revisao
- ativar auto-publish seletivo

## Criterios de Aceite

### `race_result`

- Para uma corrida finalizada com `session_results`, titulo, excerpt e body refletem corretamente vencedor e podio.
- O artigo menciona top 10 ou um subconjunto justificado.
- A imagem pertence ao mesmo GP quando disponivel.
- O artigo e bloqueado se nao houver linhas oficiais de resultado.

### `qualifying_result`

- Pole e top 3 corretos.
- O texto nao trata a corrida como se ja tivesse acontecido.

### `daily_news_roundup`

- O artigo cobre multiplos temas distintos.
- O sistema evita repetir anuncio ou fato ja coberto recentemente.

### `technical_analysis`

- O texto nao afirma setup, degradação ou estrategia de pneus sem dados suficientes no pacote de fontes.

## Observabilidade e Metricas

Medir:

- assignments criadas por tipo
- rascunhos gerados por tipo
- taxa de falha no fact-check
- taxa de rejeicao por dedupe
- confidence medio
- taxa de auto-publicacao
- taxa de edicao manual antes de publicar
- taxa de regeneracao

Metricas editoriais criticas:

- taxa de vencedor errado
- taxa de sessao errada
- taxa de imagem nao relacionada
- taxa de titulo generico

## Decisoes Fechadas

- `locale` entra agora em `editorial_assignments`, `pending_articles` e `news_articles`, com default `pt` na fase 1.
- Rascunhos que falham no fact-check sao persistidos com `review_status = failed`, ficam visiveis no `/admin/news` e so podem publicar com correcao ou override humano.
- A fila editorial do scheduler migra de `.cache/f1blog-session-scheduler.json` para `editorial_assignments`.
- Jobs de imagem nao devem ser misturados em `editorial_assignments`; se a remocao do cache tambem cobrir midia, criar tabela propria para midia/jobs genericos.
- `Resultado GP` e subtipo forte de `Noticias`: `editorialDesk = Noticias`, `assignmentType = race_result`, template `resultado-gp`.
- Copy edit roda depois de fact-check aprovado no fluxo automatico.
- `editorial_source_packets` sao persistidos para todo artigo gerado pelo pipeline editorial.
- `/topic` via Telegram e assincrono por padrao: cria assignment, retorna status e notifica conclusao depois.

## Proximo Passo Recomendado

Implementar primeiro o menor corte vertical com maior valor:

1. `editorial_assignments`
2. `editorial_source_packets`
3. classificador `race_result`
4. template `Resultado GP`
5. fact-checker de resultado de corrida
6. extensoes de metadados em `pending_articles`
7. `locale` em `news_articles`
8. fluxo de `review_status = failed` e override no `/admin/news`

Esse corte resolve o pior problema atual, cria a arquitetura-base e evita continuar empilhando regra em cima do `topic-article.ts` atual.
