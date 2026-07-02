export function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target }

  for (const key of Object.keys(source)) {
    const sourceVal = source[key]
    const targetVal = result[key]

    if (
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      )
    } else {
      result[key] = sourceVal
    }
  }

  return result
}

export function applyDelta(
  state: Record<string, unknown>,
  stateKey: string,
  data: unknown,
): Record<string, unknown> {
  if (!(stateKey in state) || data === null || typeof data !== 'object') {
    return { ...state, [stateKey]: data }
  }

  const existing = state[stateKey]
  if (typeof existing === 'object' && existing !== null && !Array.isArray(existing)) {
    return {
      ...state,
      [stateKey]: deepMerge(
        existing as Record<string, unknown>,
        data as Record<string, unknown>,
      ),
    }
  }

  return { ...state, [stateKey]: data }
}
