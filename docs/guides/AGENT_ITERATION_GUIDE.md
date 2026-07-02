# Agent Iteration Guide

## Objetivo

Padronizar iterações com agents para manter consistência entre UI, seed e banco de dados.

## Fluxo recomendado

1. **Fonte única de dados**
   - Centralizar dados de calendário de seed em `scripts/seed-data/race-calendar-data.ts`.
   - Evitar duplicar listas em componentes e scripts.

2. **Propagação das mudanças**
   - Atualizar primeiro a fonte única.
   - Reapontar consumidores:
     - `components/schedule-section.tsx`
     - `components/race-detail-modal.tsx`
     - `scripts/seed-weekend-sessions.ts`

3. **Banco de dados**
   - Aplicar schema: `pnpm db:push`
   - Popular dados: `pnpm db:seed`

4. **Cache**
   - Após seed, invalidar chave Redis do banner (`session-banner:v1`).
   - Manter fallback para banco quando Redis indisponível.

5. **Validação mínima por iteração**
   - Checar erros nos arquivos alterados.
   - Executar `pnpm db:seed` para confirmar consistência de dados.

## Regras de evolução

- Sempre usar o calendário compartilhado como origem da verdade.
- Não alterar horários de sessão em apenas um lugar.
- Para novos campos, atualizar:
   - tipo em `scripts/seed-data/race-calendar-data.ts`
  - render no modal/agenda
  - persistência no seed

## Checklist de PR

- [ ] Dados centralizados em `scripts/seed-data/race-calendar-data.ts`
- [ ] `schedule-section` e `race-detail-modal` sincronizados
- [ ] `db:seed` executa sem erro
- [ ] Cache Redis invalidado no seed
- [ ] Sem erros de diagnóstico nos arquivos modificados
