# Fantasy Phase 2 Backlog

## Objetivo

Transformar o fantasy de um MVP funcional em um produto operacional, persistente e escalável para temporada completa.

## Estado de partida

- MVP concluído com draft, lock, scoring persistido, leaderboard, simulação e E2E.
- Pit Wall Lead já opera em modelo team-based, inclusive no schema e no seed.
- Fase 2 foca profundidade de produto, operação e retenção.

## Princípios de priorização

- Prioridade alta para tudo que reduz operação manual.
- Prioridade alta para tudo que remove fragilidade de identidade e persistência.
- Prioridade média para features que aumentam profundidade competitiva.
- Prioridade média para recursos sociais e de retenção, depois que o core estiver estável.

## Backlog priorizado

| ID | Tema | Item | Prioridade | Impacto | Dependências |
|---|---|---|---|---|---|
| F2-01 | Auth | Implementar identidade real de usuário para substituir a dependência exclusiva de sessionKey | P0 | Alto | definição de auth stack |
| F2-02 | Auth | Migrar fantasy_profiles para vínculo opcional/primário com usuário autenticado, preservando sessão MVP para transição | P0 | Alto | F2-01 |
| F2-03 | Operação | Automatizar lock de rodada com job idempotente baseado no início do qualifying | P0 | Alto | nenhuma |
| F2-04 | Operação | Automatizar score oficial e reprocessamento seguro da rodada | P0 | Alto | F2-03 |
| F2-05 | Admin | Criar painel admin do fantasy para lock, score, reprocessamento e inspeção de entries | P1 | Alto | F2-03, F2-04 |
| F2-06 | Mercado | Implementar atualização de preço por rodada com histórico e explicação de delta | P1 | Alto | nenhuma |
| F2-07 | Mercado | Exibir histórico de valorização/desvalorização por asset na UI | P1 | Médio | F2-06 |
| F2-08 | Competição | Criar visão de temporada com patrimônio, evolução por rodada e ranking acumulado detalhado | P1 | Alto | F2-06 |
| F2-09 | Resultado | Melhorar breakdown de score com comparação contra média da rodada e destaques positivos/negativos | P1 | Médio | nenhuma |
| F2-10 | Analytics | Criar relatório operacional da coorte simulada fantasy-sim-01 a fantasy-sim-10 | P1 | Médio | nenhuma |
| F2-11 | Regras | Introduzir chips ou boosts de rodada como primeira camada de regra avançada | P2 | Médio | F2-04 |
| F2-12 | Regras | Modelar wildcards, proteção de DNFs e regras especiais multi-round | P2 | Médio | F2-11 |
| F2-13 | Social | Implementar mini-ligas privadas e ranking entre amigos | P2 | Alto | F2-01, F2-02 |
| F2-14 | Social | Adicionar badges, narrativa de rodada e highlights de performance | P3 | Médio | F2-08 |
| F2-15 | Qualidade | Expandir cobertura de testes para re-score, multi-round, mercado e regras avançadas | P1 | Alto | evolução contínua |
| F2-16 | Observabilidade | Criar trilha operacional com logs e métricas de scoring, lock e falhas de consistência | P1 | Alto | F2-03, F2-04 |

## Recortes de sprint

Assumindo sprints de 2 semanas com foco em entregas pequenas, mas fechadas.

## Sprint 1

### Objetivo

Eliminar a maior fragilidade operacional do fantasy: dependência de ações manuais para lock e score.

### Itens comprometidos

- F2-03 Automatização de lock de rodada.
- F2-04 Automatização de score oficial e reprocessamento idempotente.
- F2-16 Primeira camada de logs operacionais para lock e scoring.

### Entregáveis esperados

- Job ou rotina manual assistida pronta para fechar a rodada no horário correto.
- Score da rodada executável sem intervenção direta em endpoint bruto.
- Registro claro de execução, sucesso, falha e reprocessamento.

### Critério de pronto

- Rodada pode ser travada e pontuada sem edição manual no banco.
- Reprocessamento não duplica score nem corrompe breakdown.
- Logs suficientes para auditar quando e como a rodada foi processada.

## Sprint 2

### Objetivo

Dar persistência real ao jogador e preparar o fantasy para uso recorrente entre rodadas.

### Itens comprometidos

- F2-01 Implementação de auth real.
- F2-02 Evolução de fantasy_profiles para identidade persistente.
- F2-05 Primeira versão do painel admin operacional.

### Entregáveis esperados

- Usuário autenticado consegue manter histórico sem depender de sessionKey efêmera.
- Admin consegue inspecionar entries e disparar ações operacionais críticas.
- Transição controlada entre o modelo MVP e o modelo autenticado.

### Critério de pronto

- Fluxo de login e recuperação de perfil fantasy funcionando.
- Entradas antigas continuam legíveis ou migráveis.
- Painel admin cobre pelo menos lock, score e listagem de rodada.

## Sprint 3

### Objetivo

Evoluir a economia e a leitura competitiva do produto.

### Itens comprometidos

- F2-06 Atualização de preços por rodada.
- F2-07 Histórico de valorização por asset.
- F2-08 Visão expandida de temporada e patrimônio.
- F2-09 Breakdown de score com contexto comparativo.

### Entregáveis esperados

- Assets passam a contar história de mercado ao longo da temporada.
- Usuário consegue entender por que ganhou ou perdeu valor e pontos.
- Leaderboard deixa de ser só ranking bruto e vira acompanhamento de campeonato.

### Critério de pronto

- Cada rodada gera estado de preço consistente para a rodada seguinte.
- UI mostra deltas e histórico sem ambiguidade.
- Tela de temporada permite leitura clara da evolução do jogador.

## Sprint 4

### Objetivo

Adicionar profundidade de gameplay e validar retenção.

### Itens comprometidos

- F2-11 Primeira regra avançada de chips ou boosts.
- F2-13 Mini-ligas privadas.
- F2-10 Relatório operacional da coorte simulada.
- F2-15 Expansão de testes para cenário multi-round e regras novas.

### Entregáveis esperados

- Fantasy ganha mais camada estratégica sem quebrar o core existente.
- Produto passa a suportar competição social fechada.
- Time consegue acompanhar saúde da temporada com dados simulados.

### Critério de pronto

- Novas regras têm scoring auditável e cobertura mínima de teste.
- Mini-ligas permitem ranking isolado e navegação simples.
- Simulação multiusuário ajuda a validar equilíbrio antes de cada rodada.

## Itens deixados para fase posterior

- F2-12 Regras avançadas adicionais depois de validar a primeira camada de chips.
- F2-14 Badges, narrativa e superfícies de retenção mais cosméticas.

## Dependências e riscos

- A escolha de auth precisa ser feita cedo para evitar retrabalho no vínculo de profiles.
- Automação de lock e score depende de uma estratégia operacional clara em produção.
- Mercado e regras avançadas aumentam a necessidade de testes de regressão entre rodadas.
- Recursos sociais sem observabilidade suficiente tendem a dificultar suporte e investigação.

## Métricas sugeridas para acompanhar a fase 2

- Percentual de rodadas processadas sem intervenção manual.
- Tempo médio entre fim da sessão e score oficial disponível.
- Taxa de retorno por usuário entre rodadas.
- Variação média de patrimônio por rodada.
- Número de reprocessamentos por rodada.
- Taxa de falha em lock, score e atualização de preço.

## Ordem recomendada de execução

1. Operação automatizada.
2. Identidade persistente.
3. Mercado e visão de temporada.
4. Admin e observabilidade mais profunda.
5. Regras avançadas.
6. Social e retenção.