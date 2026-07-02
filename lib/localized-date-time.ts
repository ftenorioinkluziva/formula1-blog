const localeMap: Record<string, string> = {
  en: "en-US",
  pt: "pt-BR",
  es: "es-ES",
}

function resolveLocale(locale: string): string {
  return localeMap[locale] ?? locale
}

export function formatLocalDate(utcIso: string, locale: string): string {
  return new Intl.DateTimeFormat(resolveLocale(locale), {
    month: "short",
    day: "numeric",
  }).format(new Date(utcIso))
}

export function formatLocalDateWithWeekday(utcIso: string, locale: string): string {
  return new Intl.DateTimeFormat(resolveLocale(locale), {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(utcIso))
}

export function formatLocalTime(utcIso: string, locale: string): string {
  return new Intl.DateTimeFormat(resolveLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(utcIso))
}