import { useLocale, useTranslations } from 'next-intl'
import { routing } from './routing'

export function useI18n() {
  const locale = useLocale()
  const t = useTranslations()

  return {
    locale,
    t,
    locales: routing.locales,
    defaultLocale: routing.defaultLocale,
  }
}
