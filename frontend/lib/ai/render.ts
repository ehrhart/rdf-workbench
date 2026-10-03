import 'server-only'

import type { DatasetProfile } from '@/lib/ai/dataset-profile'

const XSD_NAMESPACE = 'http://www.w3.org/2001/XMLSchema#'

export function shrinkIri(
  iri: string,
  prefixes: Record<string, string>
): string {
  if (iri.startsWith(XSD_NAMESPACE)) {
    return `xsd:${iri.slice(XSD_NAMESPACE.length)}`
  }
  let bestPrefix: string | null = null
  let bestNamespace = ''
  for (const [prefix, namespace] of Object.entries(prefixes)) {
    if (iri.startsWith(namespace) && namespace.length > bestNamespace.length) {
      bestPrefix = prefix
      bestNamespace = namespace
    }
  }
  if (bestPrefix) {
    const local = iri.slice(bestNamespace.length)
    if (local.length > 0 && /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(local)) {
      return `${bestPrefix}:${local}`
    }
  }
  return iri
}

export function shrinkSample(
  sample: string,
  prefixes: Record<string, string>
): string {
  const match = /^<([^>]+)>$/.exec(sample)
  if (!match) return sample
  const shrunken = shrinkIri(match[1], prefixes)
  return shrunken === match[1] ? sample : shrunken
}

export interface RenderProfileOptions {
  /** Soft budget for the rendered text; longer profiles degrade gracefully. */
  maxChars?: number
}

/**
 * Renders the profile to compact text for the model, degrading in steps
 * when over budget: drop samples, then drop object types, then counts
 * only. The shape stays parseable at every level.
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
      `- ${shrinkIri(cls.iri, prefixes)} (${cls.instanceCount.toLocaleString('en-US')} instances)${label}`
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
        `→ ${targets.map((target) => shrinkIri(target.iri, prefixes)).join(', ')}`
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
  return `  - ${shrinkIri(property.iri, prefixes)} ×${property.count.toLocaleString('en-US')}${suffix}`
}

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text
}
