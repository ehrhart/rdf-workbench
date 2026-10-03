import 'server-only'

const IRI_PATTERN = /^https?:\/\/[^\s<>"{}|^`\\]*$/

/**
 * Returns `iri` unchanged when it is safe to interpolate into a SPARQL
 * `<...>` term; throws otherwise.
 */
export function requireSafeIri(iri: string): string {
  if (!IRI_PATTERN.test(iri)) {
    throw new Error(`Refusing to interpolate unsafe IRI: ${iri.slice(0, 120)}`)
  }
  return iri
}
