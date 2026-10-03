import type { DatasetProfile } from '@/lib/ai/dataset-profile'

const DEFAULT_EXAMPLE_COUNT = 3

function localClassName(iri: string): string {
  const localName = iri.slice(
    Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/')) + 1
  )
  try {
    return decodeURIComponent(localName)
  } catch {
    return localName
  }
}

/** Starter questions for the empty ask state, from the biggest classes. */
export function buildExampleQuestions(
  profile: DatasetProfile,
  count = DEFAULT_EXAMPLE_COUNT
): string[] {
  const limit = Math.max(count, 0)
  if (profile.classes.length === 0 || limit === 0) return []

  const topClasses = profile.classes
    .slice()
    .sort((a, b) => b.instanceCount - a.instanceCount)
    .slice(0, limit)

  return topClasses.map((cls, index) => {
    const name = localClassName(cls.iri)
    return index % 2 === 0
      ? `How many ${name} records are in the dataset?`
      : `What properties and relationships does ${name} have?`
  })
}
