import 'server-only'

import type { DatasetProfile } from '@/lib/ai/dataset-profile'
import { prefixedIri } from '@/lib/utils'

export function shrinkSample(
  sample: string,
  prefixes: Record<string, string>
): string {
  const match = /^<([^>]+)>$/.exec(sample)
  if (!match) return sample
  const shrunken = prefixedIri(match[1], prefixes)
  return shrunken === match[1] ? sample : shrunken
}

export interface RenderProfileOptions {
  /** Soft budget for the rendered text; longer profiles shrink to fit. */
  maxChars?: number
}

/**
 * Renders the profile to compact text for the model. When the text is
 * over budget it shrinks in steps: drop samples, drop object types, and
 * finally keep counts only. The shape stays parseable at every level.
 */
export function renderProfileText(
  profile: DatasetProfile,
  options: RenderProfileOptions = {}
): string {
  const maxChars = options.maxChars ?? 140_000
  const prefixes = profile.prefixes
  const levels: Array<
    'full' | 'no-samples' | 'no-object-types' | 'counts-only'
  > = ['full', 'no-samples', 'no-object-types', 'counts-only']

  for (const level of levels) {
    const text = renderAtLevel(profile, prefixes, level)
    if (text.length <= maxChars || level === 'counts-only') return text
  }
  return renderAtLevel(profile, prefixes, 'counts-only')
}

function renderAtLevel(
  profile: DatasetProfile,
  prefixes: Record<string, string>,
  level: 'full' | 'no-samples' | 'no-object-types' | 'counts-only'
): string {
  const lines: string[] = []
  lines.push('# Dataset profile')
  lines.push(`endpoint: ${profile.endpoint}`)
  lines.push(`engine: ${profile.provider}`)
  if (profile.tripleCount !== null) {
    lines.push(`total triples: ${profile.tripleCount.toLocaleString('en-US')}`)
  }
  const graphCount = profile.graphs.length
  if (graphCount > 0) {
    lines.push(
      `named graphs: ${profile.graphs
        .slice(0, 8)
        .map((graph) => graph.uri)
        .join(', ')}${graphCount > 8 ? `, … (${graphCount} total)` : ''}`
    )
  }
  const prefixList = Object.entries(profile.prefixes)
  if (prefixList.length > 0) {
    lines.push(
      `prefixes: ${prefixList
        .map(([prefix, namespace]) => `${prefix}: <${namespace}>`)
        .join(' ')}`
    )
  }

  lines.push('')
  lines.push(
    'Classes (rdf:type targets) with instance counts. Properties per class list usage counts, the classes or datatypes their objects have, and sample values.'
  )
  for (const cls of profile.classes) {
    const label = cls.label ? ` — "${truncate(cls.label, 80)}"` : ''
    lines.push(
      `- ${prefixedIri(cls.iri, prefixes)} (${cls.instanceCount.toLocaleString('en-US')} instances)${label}`
    )
    for (const property of cls.properties) {
      lines.push(renderPropertyLine(property, prefixes, level))
    }
  }

  if (profile.looseProperties.length > 0) {
    lines.push('')
    lines.push(
      'Properties observed on subjects without any rdf:type (or not covered above):'
    )
    for (const property of profile.looseProperties) {
      lines.push(renderPropertyLine(property, prefixes, level))
    }
  }

  return lines.join('\n')
}

function renderPropertyLine(
  property: {
    iri: string
    count: number
    objectTypes: DatasetProfile['classes'][number]['properties'][number]['objectTypes']
    samples: string[]
  },
  prefixes: Record<string, string>,
  level: 'full' | 'no-samples' | 'no-object-types' | 'counts-only'
): string {
  const parts: string[] = []
  if (level !== 'counts-only') {
    const targets = level === 'no-object-types' ? [] : property.objectTypes
    if (targets.length > 0) {
      parts.push(
        `→ ${targets.map((target) => prefixedIri(target.iri, prefixes)).join(', ')}`
      )
    }
    if (level === 'full' && property.samples.length > 0) {
      parts.push(
        `e.g. ${property.samples
          .map((sample) => shrinkSample(sample, prefixes))
          .join(' | ')}`
      )
    }
  }
  const suffix = parts.length > 0 ? `  ${parts.join('  ')}` : ''
  return `  - ${prefixedIri(property.iri, prefixes)} ×${property.count.toLocaleString('en-US')}${suffix}`
}

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text
}
