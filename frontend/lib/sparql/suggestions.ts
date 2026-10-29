import type { ResourceSuggestion } from '@/types'

/**
 * Resource suggestions are keyed by their resource in the UI, and one
 * resource can match through several indexed literals. Adapters that map
 * raw engine rows enforce uniqueness here, keeping the first occurrence,
 * which is the most relevant one because engines order by score.
 */
export function dedupeSuggestions(
  suggestions: ResourceSuggestion[]
): ResourceSuggestion[] {
  const seen = new Set<string>()
  return suggestions.filter((suggestion) => {
    if (!suggestion.resource || seen.has(suggestion.resource)) return false
    seen.add(suggestion.resource)
    return true
  })
}
