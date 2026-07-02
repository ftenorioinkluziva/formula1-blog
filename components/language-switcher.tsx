'use client'

import { usePathname, useRouter } from '@/lib/i18n/routing'
import { useLocale } from 'next-intl'
import { localeNames, type Locale } from '@/lib/i18n/config'

export function LanguageSwitcher() {
  const pathname = usePathname()
  const router = useRouter()
  const currentLocale = useLocale()

  const handleLocaleChange = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale })
  }

  return (
    <div className="flex items-center gap-1 md:gap-1.5">
      {Object.entries(localeNames).map(([locale, name]) => (
        <button
          key={locale}
          onClick={() => handleLocaleChange(locale as Locale)}
          className={`px-3 md:px-2 py-2 md:py-1 text-sm md:text-xs font-bold uppercase tracking-wider transition-colors rounded-sm ${
            currentLocale === locale
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
          }`}
          aria-label={`Switch to ${name}`}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
