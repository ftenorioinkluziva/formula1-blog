export function parseNewsDate(value: string | Date | null | undefined): Date {
  if (value instanceof Date) return value
  if (!value) return new Date()

  const dateValue = value.trim()
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateValue)
  if (brMatch) {
    const [, day, month, year] = brMatch
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  const parsed = new Date(dateValue)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}
