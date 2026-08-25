import type {
  SparqlBindingsResult,
  SparqlBooleanResult,
  SparqlGraphResult,
  SparqlQueryResult
} from '@/types'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function escapeTsv(value: string): string {
  return value.replace(/[\t\n\r]/g, ' ')
}

export function serializeBindingsToCsv(result: SparqlBindingsResult): string {
  const header = result.variables.join(',')
  const rows = result.bindings.map((binding) =>
    result.variables
      .map((variable) => {
        const cell = binding[variable]
        return cell ? escapeCsv(cell.value) : ''
      })
      .join(',')
  )
  return [header, ...rows].join('\n')
}

export function serializeBindingsToTsv(result: SparqlBindingsResult): string {
  const header = result.variables.join('\t')
  const rows = result.bindings.map((binding) =>
    result.variables
      .map((variable) => {
        const cell = binding[variable]
        return cell ? escapeTsv(cell.value) : ''
      })
      .join('\t')
  )
  return [header, ...rows].join('\n')
}

export function serializeBindingsToXml(result: SparqlBindingsResult): string {
  const head = result.variables
    .map((variable) => `<variable name="${escapeXml(variable)}"/>`)
    .join('')
  const rows = result.bindings.map((binding) => {
    const cells = result.variables
      .map((variable) => {
        const cell = binding[variable]
        if (!cell) return ''
        if (cell.type === 'uri') {
          return `<uri>${escapeXml(cell.value)}</uri>`
        }
        if (cell.type === 'bnode') {
          return `<bnode>${escapeXml(cell.value)}</bnode>`
        }
        const lang =
          'xml:lang' in cell && cell['xml:lang']
            ? ` xml:lang="${escapeXml(cell['xml:lang'])}"`
            : ''
        const datatype = cell.datatype
          ? ` datatype="${escapeXml(cell.datatype)}"`
          : ''
        return `<literal${datatype}${lang}>${escapeXml(cell.value)}</literal>`
      })
      .join('')
    return `  <result>${cells}</result>`
  })
  return [
    '<?xml version="1.0"?>',
    '<sparql xmlns="http://www.w3.org/2005/sparql-results#">',
    `  <head>${head}</head>`,
    '  <results>',
    rows.join('\n'),
    '  </results>',
    '</sparql>'
  ].join('\n')
}

export function serializeBooleanToJson(result: SparqlBooleanResult): string {
  return JSON.stringify({ head: {}, boolean: result.value })
}

export function serializeBooleanToXml(result: SparqlBooleanResult): string {
  return [
    '<?xml version="1.0"?>',
    '<sparql xmlns="http://www.w3.org/2005/sparql-results#">',
    '  <head/>',
    `  <boolean>${result.value}</boolean>`,
    '</sparql>'
  ].join('\n')
}

export function serializeBindingsToJson(result: SparqlBindingsResult): string {
  return JSON.stringify({
    head: { vars: result.variables },
    results: { bindings: result.bindings }
  })
}

export interface SerializedDownload {
  body: string
  contentType: string
}

export function serializeResults(
  result: SparqlQueryResult,
  format: string
): SerializedDownload | null {
  switch (format) {
    case 'application/sparql-results+json':
      if (result.kind === 'bindings') {
        return {
          body: serializeBindingsToJson(result),
          contentType: 'application/sparql-results+json'
        }
      }
      if (result.kind === 'boolean') {
        return {
          body: serializeBooleanToJson(result),
          contentType: 'application/sparql-results+json'
        }
      }
      return null
    case 'text/csv':
      if (result.kind !== 'bindings') return null
      return { body: serializeBindingsToCsv(result), contentType: 'text/csv' }
    case 'text/tab-separated-values':
      if (result.kind !== 'bindings') return null
      return {
        body: serializeBindingsToTsv(result),
        contentType: 'text/tab-separated-values'
      }
    case 'application/sparql-results+xml':
      if (result.kind === 'bindings') {
        return {
          body: serializeBindingsToXml(result),
          contentType: 'application/sparql-results+xml'
        }
      }
      if (result.kind === 'boolean') {
        return {
          body: serializeBooleanToXml(result),
          contentType: 'application/sparql-results+xml'
        }
      }
      return null
    case 'text/turtle':
      if (result.kind === 'graph') {
        const graph = result as SparqlGraphResult
        return { body: graph.value, contentType: 'text/turtle' }
      }
      return null
    default:
      return null
  }
}
