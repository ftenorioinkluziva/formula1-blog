# Backlog Tecnico: Automacao Editorial de F1

Este documento traduz a [Especificacao de Automacao Editorial](./EDITORIAL_AUTOMATION_SPEC.md) em um backlog tecnico priorizado, resolvendo lacunas de design e mapeando a implementacao em sprints.

---

## 1. Gaps e Falhas de Especificacao Detectados e Resolvidos

Durante a revisao da especificacao original, foram identificados e enderecados os seguintes pontos criticos:

### A. Suporte a Locale i18n

**Problema:** O blog possui rotas internacionalizadas (`/en`, `/pt`, `/es`), mas a especificacao nao detalhava como noticias e rascunhos sao segmentados por idioma.

**Resolucao:** Adicionar uma coluna `locale`, por exemplo `varchar("locale", { length: 8 }).notNull().default("pt")`, nas tabelas `editorial_assignments`, `pending_articles` e `news_articles`.
Isso garante compatibilidade com o sistema de rotas sem misturar conteudos e permite futura expansao para outros idiomas.

### B. Persistencia do Estado de Execucao da Fila

**Problema:** Atualmente, o `session-scheduler.ts` usa o arquivo local `.cache/f1blog-session-scheduler.json` para rastrear tentativas e agendamentos. A especificacao propoe `editorial_assignments`, mas precisava explicitar os campos de execucao.

**Resolucao:** Incluir colunas operacionais em `editorial_assignments` para centralizar a fila editorial:

- `attempt_count` com default `0`
- `last_attempt_at`
- `next_attempt_at`
- `completed_at`
- `last_error` ou `error_log`
- `locked_at`
- `locked_by`
- `source_event_key`

Isso elimina o arquivo `.cache` para jobs editoriais, torna o agendamento mais seguro em ambiente com workers e deixa o estado visivel no painel admin.
Jobs que nao sao editoriais, como scraping/sync de imagens, devem usar tabela propria se tambem forem removidos do cache local.

### C. Fluxo de Falha no Fact-Check

**Problema:** A especificacao afirmava que o fact-check e bloqueante para publicacao automatica, mas nao deixava claro o que acontece com artigos que falham.

**Resolucao:** Artigos com falha de fact-check devem ser persistidos em `pending_articles` com `review_status = 'failed'`, e suas falhas registradas em `editorial_reviews`.
Isso permite que o editor humano visualize o rascunho com alertas factuais no painel `/admin/news`, corrija o texto e faca publicacao manual por override.

### D. Rastreabilidade Pos-Publicacao

**Problema:** Quando um rascunho e promovido, uma nova linha e criada em `news_articles` e a linha em `pending_articles` ganha status `published`, mas nao ha chave explicita ligando as tabelas ou associando ao assignment original.

**Resolucao:** Adicionar `news_article_id` nullable em `editorial_assignments` e `pending_articles` para garantir rastreabilidade bidirecional.

### E. Salvaguarda na Selecao de Imagens

**Problema:** O fallback final para selecao de imagens era aleatorio. Isso pode associar uma foto de piloto, equipe ou contexto errado a uma noticia sensivel.

**Resolucao:** Definir imagem padrao de cobertura generica do GP, imagem editorial neutra ou imagem padrao do blog como fallback seguro, em vez de selecao aleatoria irrestrita.

---

## 2. Principios de Priorizacao

- **P0 Bloqueante:** Banco de dados, classificacao inicial e geracao de pacotes factuais confiaveis.
- **P1 Critico:** Templates especializados de escrita, motor de fact-check e persistencia de rascunhos.
- **P2 Importante:** Deduplicacao, refinamento de imagens e expansao do painel `/admin/news`.
- **P3 Desejavel:** Automacao total de auto-publish em sessoes factuais duras e metricas avancadas.

---

## 3. Backlog Priorizado

| ID | Tema | Item | Prioridade | Impacto | Dependencias |
|---|---|---|---|---|---|
| **ED-01** | Banco | Criar migracao Drizzle com novas tabelas (`editorial_assignments`, `editorial_source_packets`, `editorial_reviews`, `article_source_links`) e colunas de extensao em `pending_articles` e `news_articles`. | **P0** | Alto | Nenhuma |
| **ED-02** | Fila/Job | Migrar controle editorial de agendamento do `session-scheduler.ts` do arquivo JSON para `editorial_assignments`. | **P0** | Alto | ED-01 |
| **ED-03** | Core | Implementar classificador de pautas (`lib/editorial/assignment-classifier.ts`) para mapear topicos/sessoes em assignments estruturados. | **P0** | Alto | ED-01 |
| **ED-04** | Core | Criar construtor de pacotes de dados (`lib/editorial/source-packet-builder.ts`) centralizando resultados, classificacao, stints, clima e midia em JSON estruturado. | **P0** | Alto | ED-01 |
| **ED-05** | Escrita | Desenvolver biblioteca de templates por mesa/tipo (`lib/editorial/templates/*`) com tom, restricoes e schemas JSON de saida. | **P1** | Alto | ED-04 |
| **ED-06** | Escrita | Implementar gerador de rascunho (`lib/editorial/writer.ts`) usando o modelo configurado do projeto. | **P1** | Alto | ED-05 |
| **ED-07** | Revisao | Desenvolver motor de fact-check (`lib/editorial/fact-checker.ts`) para validar rascunhos contra o pacote de fontes original. | **P1** | Alto | ED-04, ED-06 |
| **ED-08** | Imagem | Implementar seletor contextual de imagens (`lib/editorial/sources/media-source.ts`) com base nos metadados de galerias de corrida. | **P2** | Medio | ED-04 |
| **ED-09** | Dedupe | Criar motor de deduplicacao (`lib/editorial/dedupe.ts`) por chaves estruturadas e verificacao de angulo semantico. | **P2** | Medio | ED-03 |
| **ED-10** | Admin | Expandir `/admin/news` para exibir metadados editoriais, logs de fact-check, badges de confianca e avisos. | **P2** | Alto | ED-01, ED-07 |
| **ED-11** | Admin | Modificar acoes de publicar/ignorar no admin para atualizar o assignment correspondente e preencher `news_article_id`. | **P2** | Medio | ED-10 |
| **ED-12** | Pipeline | Consolidar orquestrador principal (`lib/editorial/pipeline.ts`) conectando classificacao, apuracao, escrita, validacao, imagens e persistencia. | **P1** | Alto | ED-03, ED-04, ED-06, ED-07 |
| **ED-13** | Integracao | Atualizar `scripts/topic-article.ts` e o bot do Telegram para acionarem o novo pipeline de forma assincrona. | **P2** | Medio | ED-12 |
| **ED-14** | Automacao | Implementar regras de auto-publish seletivo na fase 2 para sessoes de resultados com alta confianca. | **P3** | Medio | ED-12, ED-07 |
| **ED-15** | Qualidade | Escrever testes e2e para simular fim de sessao -> assignment automatico -> pacote de fontes -> escrita -> aprovacao manual. | **P1** | Alto | ED-12 |

---

## 4. Recortes de Sprint

### Sprint 1: Infraestrutura de Dados e Apuracao

**Objetivo:** Estabelecer o modelo fisico de dados, migrar o agendador editorial e criar a engine de preparacao de fontes factuais.

**Itens comprometidos:**

- `ED-01` Migracao do banco de dados.
- `ED-02` Centralizacao da fila editorial do scheduler no banco.
- `ED-04` Construtor de pacotes de dados factuais.

**Criterio de pronto:**

- Tabelas editoriais criadas no banco local com indices corretos.
- O script de agendamento roda sem criar arquivo JSON local para jobs editoriais.
- Um comando de teste extrai o JSON de fontes de uma corrida finalizada no formato esperado pela escrita.

### Sprint 2: Classificacao e Geracao de Rascunhos

**Objetivo:** Habilitar a IA a entender a pauta e redigir o artigo inicial usando templates especificos.

**Itens comprometidos:**

- `ED-03` Classificador de assignments.
- `ED-05` Templates especializados: `Noticias`, `resultado-gp`, `Raio-X Tecnico`.
- `ED-06` Motor de redacao do rascunho.

**Criterio de pronto:**

- Topicos livres ou sessoes encerradas sao categorizados com alto indice de acerto.
- O sistema gera rascunhos aderentes aos templates, com JSON contendo titulo, resumo e paragrafos.
- Rascunhos sao armazenados em `pending_articles` vinculados aos assignments.

### Sprint 3: Fact-Check, Dedupe e Imagem

**Objetivo:** Adicionar barreiras de qualidade para garantir verdade dos dados, selecao correta de imagens e controle de redundancia.

**Itens comprometidos:**

- `ED-07` Motor de fact-check.
- `ED-08` Seletor inteligente de fotos.
- `ED-09` Motor de deduplicacao.
- `ED-12` Pipeline principal unificado.

**Criterio de pronto:**

- Artigos gerados passam obrigatoriamente pela validacao factual.
- Qualquer desvio de vencedor, grid ou podio gera falha reportada.
- Imagens de galerias locais associadas ao GP/piloto sao preferidas, com fallback seguro.
- O pipeline completo roda de ponta a ponta e pode ser testado por script.

### Sprint 4: Experiencia Editorial e Automacao

**Objetivo:** Dar visibilidade de producao aos editores no painel `/admin/news` e habilitar publicacao autonoma segura.

**Itens comprometidos:**

- `ED-10` Expansao de UX no painel admin.
- `ED-11` Integracao de acoes e chaves de rastreabilidade.
- `ED-13` Integracao com Telegram/CLI.
- `ED-14` Mecanismo de auto-publish.

**Criterio de pronto:**

- O painel admin exibe avisos do fact-check, status de deduplicacao e link de fontes nos artigos pendentes.
- Usuario consegue publicar um artigo com falha no fact-check por override, registrando logs.
- Resultados oficiais com alta confianca e fact-check aprovado podem ser publicados automaticamente sem intervencao humana.

---

## 5. Riscos e Dependencias Tecnicas

1. **Dependencia de apuracao:** o source packet depende da consistencia de `session_results`, `lap_summaries`, `drivers`, standings e dados de enriquecimento. O sincronizador de resultados deve rodar antes da automacao editorial.
2. **Latencia de API:** classificacao, escrita e fact-check podem levar 15 a 30 segundos por artigo. O pipeline deve rodar de forma assincrona via `editorial_assignments`.
3. **Custo de tokens:** fact-check e escrita detalhada consomem contexto. Os prompts devem passar apenas o subconjunto relevante do pacote de fontes.
4. **Escopo de scheduler:** remover `.cache/f1blog-session-scheduler.json` para jobs editoriais nao deve obrigar que jobs de imagem sejam modelados como artigos. Midia precisa de fila propria se entrar na mesma migracao.
