export function adjustHexBrightness(hex: string, amount: number): string {
  const clean = hex.replace("#", "")
  const r = Math.min(255, Math.max(0, parseInt(clean.substring(0, 2), 16) + amount))
  const g = Math.min(255, Math.max(0, parseInt(clean.substring(2, 4), 16) + amount))
  const b = Math.min(255, Math.max(0, parseInt(clean.substring(4, 6), 16) + amount))
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

export function buildDriverColorMap(
  drivers: Array<{ code: string; teamColor: string; teamName: string }>,
): Map<string, string> {
  const colorMap = new Map<string, string>()
  const teamDriverCount = new Map<string, number>()

  for (const driver of drivers) {
    const count = teamDriverCount.get(driver.teamName) ?? 0
    teamDriverCount.set(driver.teamName, count + 1)

    const color = count === 0 ? driver.teamColor : adjustHexBrightness(driver.teamColor, 60)
    colorMap.set(driver.code, color)
  }

  return colorMap
}
