# i18n Setup Completo ✅

## Estrutura Criada

```
lib/i18n/
  ├── config.ts          # Locales disponíveis (en, pt, es)
  ├── routing.ts         # Configuração de rotas + helpers (Link, useRouter, etc)
  ├── request.ts         # Loader de mensagens server-side
  └── client.ts          # Hook useI18n para client components

messages/
  ├── en.json            # Dicionário inglês
  ├── pt.json            # Dicionário português
  └── es.json            # Dicionário espanhol

app/[locale]/
  ├── layout.tsx         # Root layout com NextIntlClientProvider
  ├── page.tsx           # Homepage
  └── globals.css

components/
  └── language-switcher.tsx  # Componente para trocar idioma

middleware.ts              # Middleware de detecção de locale
next.config.mjs            # Configuração next-intl
```

## URLs

- `/en` → Inglês (padrão)
- `/pt` → Português
- `/es` → Espanhol

Acessar `/` redireciona automaticamente para `/en` (ou locale detectado via `Accept-Language`).

## Como Usar

### Server Components

```tsx
import { useTranslations } from 'next-intl'

export default function MyComponent() {
  const t = useTranslations('home.navigation')
  return <h1>{t('teams')}</h1>
}
```

### Client Components

```tsx
'use client'
import { useI18n } from '@/lib/i18n/client'

export default function MyComponent() {
  const { t, locale } = useI18n()
  return <p>{t('home.common.loading')}</p>
}
```

### Links Internos

Use o `Link` do next-intl (mantém o locale automaticamente):

```tsx
import { Link } from '@/lib/i18n/routing'

<Link href="/about">About</Link>
// /en → /en/about
// /pt → /pt/about
```

### Trocar Idioma (Client-Side)

Adicione o `<LanguageSwitcher />` em qualquer componente:

```tsx
import { LanguageSwitcher } from '@/components/language-switcher'

<LanguageSwitcher />
```

## Próximos Passos

1. **Traduzir componentes existentes**: Substitua textos fixos por `t('chave')`
2. **Expandir dicionários**: Adicione mais chaves conforme necessário
3. **API/DB multilíngue**: 
   - Use `params.locale` em server components para buscar conteúdo traduzido
   - Exemplo: `await fetchNews(locale)`
4. **SEO**: Configure `alternates` no metadata para hreflang

## Exemplo: Traduzir Navigation

Antes:
```tsx
<a href="#teams">Teams</a>
```

Depois:
```tsx
'use client'
import { useTranslations } from 'next-intl'

const t = useTranslations('home.navigation')
<a href="#teams">{t('teams')}</a>
```

## Convenção de Namespaces

- `home.*`: textos da homepage (`home.navigation`, `home.sections`, `home.common`, `home.footer`)
- `liveTiming.*`: textos da área de live timing (`liveTiming.unused`, `liveTiming.championshipPredictionCompact`)

Guia completo de naming: `I18N_NAMING.md`.
