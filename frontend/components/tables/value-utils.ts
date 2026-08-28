/**
 * Extracts a comparable string representation from various cell value types.
 */
export function getComparableValue(value: unknown): string {
  if (value == null) return ''

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  if (typeof value === 'object') {
    // Handle common shapes like RDF nodes or SPARQL binding values with a `value` field.
    if ('value' in (value as Record<string, unknown>)) {
      const inner = (value as Record<string, unknown>).value
      return inner == null ? '' : String(inner)
    }

    // Fallback to JSON stringification for other objects.
    try {
      return JSON.stringify(value)
    } catch (error) {
      console.error('Failed to stringify table cell value', error)
      return ''
    }
  }

  return ''
}

/**
 * Locale-aware comparison for TanStack sorting functions.
 */
export function compareValues(a: unknown, b: unknown): number {
  const valueA = getComparableValue(a)
  const valueB = getComparableValue(b)

  if (valueA === valueB) return 0
  if (!valueA) return 1
  if (!valueB) return -1

  return valueA.localeCompare(valueB)
}
