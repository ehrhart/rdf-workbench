import { describe, expect, it } from 'vitest'
import {
  dereferencePathFormatIssue,
  dereferencePathIssue,
  validateDereferencePath
} from './rules'

const FORMAT_MESSAGE =
  'Path must be a lowercase URL path segment without separators, dot prefixes, or characters that require percent-encoding'

describe('dereferencePathFormatIssue', () => {
  it('accepts a usable path segment', () => {
    expect(dereferencePathFormatIssue('person')).toBeNull()
    expect(dereferencePathFormatIssue('  person  ')).toBeNull()
    expect(dereferencePathFormatIssue('a'.repeat(64))).toBeNull()
  })

  it('rejects an empty path', () => {
    expect(dereferencePathFormatIssue('')).toBe('A path is required')
    expect(dereferencePathFormatIssue('   ')).toBe('A path is required')
  })

  it('rejects an overlong path', () => {
    expect(dereferencePathFormatIssue('a'.repeat(65))).toBe(
      'Path must be at most 64 characters'
    )
  })

  it('rejects segments the endpoint could not serve', () => {
    for (const path of ['SPARQL', 'per son', 'per/son', 'a%20b', '.hidden']) {
      expect(dereferencePathFormatIssue(path)).toBe(FORMAT_MESSAGE)
    }
  })
})

describe('dereferencePathIssue', () => {
  const reserved = ['admin', 'sparql']

  it('reports the format before the reservation', () => {
    expect(dereferencePathIssue('SPARQL', reserved)).toBe(FORMAT_MESSAGE)
  })

  it('reports a reserved path', () => {
    expect(dereferencePathIssue('sparql', reserved)).toBe(
      'Path "/sparql" is reserved'
    )
  })

  it('returns null for a usable unreserved path', () => {
    expect(dereferencePathIssue('person', reserved)).toBeNull()
  })
})

describe('validateDereferencePath', () => {
  it('returns the trimmed path when usable', () => {
    expect(validateDereferencePath(' person ', 'generic')).toBe('person')
  })

  it('rejects reserved paths', () => {
    expect(() => validateDereferencePath('admin', 'generic')).toThrow(
      'Path "/admin" is reserved'
    )
  })
})
