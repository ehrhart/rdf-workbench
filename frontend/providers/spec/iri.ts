import 'server-only'

export function assertSafeSparqlIri(value: string, name: string): void {
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    throw new Error(`${name} must be an absolute IRI`)
  }
  if (/[<>"{}|^`\\\s]/.test(value)) {
    throw new Error(`${name} contains characters not allowed in an IRI`)
  }
}
