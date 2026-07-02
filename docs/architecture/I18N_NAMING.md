# I18N Naming Convention

## Objetivo
Padronizar nomes de namespaces e chaves de tradução para manter consistência, facilitar manutenção e evitar duplicidade.

## Estrutura de Namespaces
Use namespaces por domínio de produto:

- `home.*` para homepage
  - `home.navigation`
  - `home.sections`
  - `home.common`
  - `home.footer`
- `liveTiming.*` para live timing
  - `liveTiming.unused`
  - `liveTiming.championshipPredictionCompact`

## Regras de Nomeação
- Use `camelCase` para namespaces e chaves.
- Nomeie por contexto de UI, não por tecnologia.
  - Bom: `home.sections.news.readAll`
  - Evitar: `buttonReadAll`
- Evite abreviações ambíguas.
  - Bom: `pointsSuffix`
  - Evitar: `ptsSfx`
- Chaves irmãs devem seguir padrão paralelo entre idiomas.
- Não duplicar textos iguais em múltiplos namespaces sem necessidade real de contexto.

## Padrão de Uso no Código

### Server Component
```tsx
import { useTranslations } from 'next-intl'

const t = useTranslations('home.navigation')
t('teams')
```

### Client Component (helper do projeto)
```tsx
import { useI18n } from '@/lib/i18n/client'

const { t } = useI18n()
t('liveTiming.championshipPredictionCompact.titleLive')
```

## Processo para Adicionar Novas Chaves
1. Defina o domínio (`home`, `liveTiming`, etc.).
2. Escolha subnamespace semântico (`sections`, `footer`, `unused`, etc.).
3. Adicione a mesma chave em `messages/pt.json`, `messages/en.json` e `messages/es.json`.
4. Use a chave no componente via `t('namespace.chave')`.
5. Rode build para validação.

## Checklist de PR
- [ ] Namespace segue domínio correto.
- [ ] Chave em `camelCase`.
- [ ] Chave presente nos 3 idiomas.
- [ ] Sem chaves antigas órfãs.
- [ ] Build sem erros de i18n.
