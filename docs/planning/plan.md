# Plano de Implementação

## Ponto 1: Sync automático de standings via Jolpica-F1 API

### Contexto
Hoje os campos `points`, `position`, `wins`, `podiums`, `poles` nas tabelas `drivers` e `teams` são seedados com `0` e **nunca atualizados**. Não existe nenhum mecanismo de update no codebase.

### Abordagem
Criar um script `pnpm db:sync-standings` que consome a Jolpica-F1 API e atualiza o DB.

### Arquivos a criar/modificar

**1. `lib/jolpica/client.ts`** (novo)
- Função `fetchDriverStandings(season)` → GET `https://api.jolpi.ca/ergast/f1/{season}/driverstandings/?limit=100`
- Função `fetchConstructorStandings(season)` → GET `https://api.jolpi.ca/ergast/f1/{season}/constructorstandings/?limit=100`
- Função `fetchRaceResults(season, round)` → GET `https://api.jolpi.ca/ergast/f1/{season}/{round}/results/?limit=100`
- Retry com backoff para rate limits
- Tipos TypeScript para os responses `MRData`

**2. `lib/db/standings.ts`** (novo)
- `syncDriverStandings(season)` — recebe dados da Jolpica e faz `db.update(drivers)` para cada piloto, mapeando por `code` (ex: "VER", "NOR")
  - Atualiza: `points`, `position`, `wins`, `podiums`
- `syncTeamStandings(season)` — recebe dados da Jolpica e faz `db.update(teams)` para cada equipe, mapeando por `name`
  - Atualiza: `points`, `position`, `wins`
- A lógica de mapping precisa lidar com diferenças de nome (ex: "Red Bull" vs "Red Bull Racing") — usar uma tabela de aliases

**3. `scripts/sync-standings.ts`** (novo)
- Script executável via `pnpm db:sync-standings`
- Resolve a season atual, busca standings da Jolpica, chama as funções de sync
- Log de cada update com diff (old → new)

**4. `app/[locale]/api/sync-standings/route.ts`** (novo)
- POST endpoint para trigger manual via admin (ou futuro cron)
- Chama as mesmas funções do script
- Retorna summary do que foi atualizado

**5. `package.json`** — adicionar script `db:sync-standings`

**6. `lib/db/race-weekends.ts`** — adicionar função `getLastCompletedRound(season)` para saber até qual round buscar results (para determinar winner de cada GP no schedule)

### Dados que a Jolpica retorna (driver standings)
```json
{
  "position": "1",
  "points": "63",
  "wins": "2",
  "Driver": { "code": "NOR", "givenName": "Lando", "familyName": "Norris" },
  "Constructors": [{ "name": "McLaren" }]
}
```

### Dados que a Jolpica retorna (constructor standings)
```json
{
  "position": "1",
  "points": "113",
  "wins": "3",
  "Constructor": { "constructorId": "mclaren", "name": "McLaren" }
}
```

### Mapeamento driver code → DB
O campo `drivers.code` no DB já contém "NOR", "VER", etc. — match direto com `Driver.code` da Jolpica.

### Mapeamento team name → DB
Criar um mapa de aliases pois os nomes podem diferir:
- Jolpica "Red Bull" → DB "Red Bull Racing"
- Jolpica "Sauber" → DB "Audi"
- etc.

---

## Ponto 2: Schedule — destaque avança para o próximo GP

### Contexto
A lógica de comparação `startUtc >= now` **já existe** em `schedule-section.tsx:64`, mas o `useMemo` só recalcula quando `sourceRaces` muda (fetch único no mount). Após a corrida terminar, o highlight não avança sem reload.

### Correção
Adicionar um state `now` que atualiza periodicamente (a cada 60 segundos), forçando o `useMemo` a recalcular.

### Arquivo a modificar: `components/schedule-section.tsx`

**Mudanças:**
1. Adicionar state `now` com `useState(new Date())`
2. Adicionar `useEffect` com `setInterval` de 60s para atualizar `now`
3. Passar `now` como dependência do `useMemo` que calcula os status dos GPs
4. O `useMemo` já usa `new Date()` internamente — basta trocar por `now` do state

```tsx
// Adicionar:
const [now, setNow] = useState(() => new Date())

useEffect(() => {
  const interval = setInterval(() => setNow(new Date()), 60_000)
  return () => clearInterval(interval)
}, [])

// Modificar o useMemo para usar `now` do state em vez de `new Date()`:
const races = useMemo(() => {
  // ... usar `now` em vez de `const now = new Date()`
}, [sourceRaces, now])  // adicionar `now` como dep
```

---

## Ordem de execução

1. **Ponto 2 (Schedule)** — correção simples, ~10 linhas alteradas
2. **Ponto 1 (Standings)** — feature nova, ~4 arquivos novos
