export type CopyBodyMode = 'raw' | 'json'

export interface CopyRequestDescriptor {
  endpoint: string
  headers?: Record<string, string>
  bodyMode: CopyBodyMode
}

export interface CopySnippetAction {
  id: 'url' | 'curl' | 'powershell' | 'fetch' | 'python'
  label: string
  build: (input: { request: CopyRequestDescriptor; query: string }) => string
}

interface BuildSnippetInput {
  request: CopyRequestDescriptor
  query: string
}

const absoluteEndpointUrl = (endpoint: string) =>
  new URL(endpoint, window.location.origin).href

const getRequestBodyText = (query: string, bodyMode: CopyBodyMode) =>
  bodyMode === 'json' ? JSON.stringify({ query }) : query

const shellQuote = (value: string) => `'${value.replaceAll("'", `'\\''`)}'`

const powershellQuote = (value: string) => `'${value.replaceAll("'", "''")}'`

const buildUrlSnippet = ({ query }: BuildSnippetInput) =>
  `${window.location.origin}${window.location.pathname}?query=${encodeURIComponent(
    query
  )}`

const buildCurlSnippet = ({ request, query }: BuildSnippetInput) => {
  const lines = [
    `curl -X POST ${shellQuote(absoluteEndpointUrl(request.endpoint))}`
  ]
  for (const [key, value] of Object.entries(request.headers ?? {})) {
    lines.push(`  -H ${shellQuote(`${key}: ${value}`)}`)
  }
  lines.push(
    `  --data-binary ${shellQuote(getRequestBodyText(query, request.bodyMode))}`
  )
  return lines.join(' \\\n')
}

const buildPowerShellSnippet = ({ request, query }: BuildSnippetInput) => {
  const { 'Content-Type': contentType, ...otherHeaders } = request.headers ?? {}
  const parameters = ['-Method Post']
  if (contentType !== undefined) {
    parameters.push(`-ContentType ${powershellQuote(contentType)}`)
  }
  const otherHeaderEntries = Object.entries(otherHeaders)
  if (otherHeaderEntries.length > 0) {
    const pairs = otherHeaderEntries
      .map(([key, value]) => `'${key}' = '${value}'`)
      .join('; ')
    parameters.push(`-Headers @{ ${pairs} }`)
  }
  parameters.push(
    `-Body ${powershellQuote(getRequestBodyText(query, request.bodyMode))}`
  )
  const lines = [
    `Invoke-RestMethod -Uri ${powershellQuote(
      absoluteEndpointUrl(request.endpoint)
    )}`,
    ...parameters.map((parameter) => `  ${parameter}`)
  ]
  return lines
    .map((line, index) => (index === lines.length - 1 ? line : `${line} \``))
    .join('\n')
}

const escapeTemplateLiteralBody = (text: string) =>
  text.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${')

const buildFetchBodyExpression = (
  request: CopyRequestDescriptor,
  query: string
) => {
  if (request.bodyMode === 'json') {
    return `JSON.stringify({ query: ${JSON.stringify(query)} })`
  }
  return `\`${escapeTemplateLiteralBody(query)}\``
}

const buildFetchSnippet = ({ request, query }: BuildSnippetInput) => {
  const headerEntries = Object.entries(request.headers ?? {})
  const optionLines = [`  method: 'POST'`]
  if (headerEntries.length > 0) {
    const headerLines = headerEntries.map(
      ([key, value]) => `    '${key}': '${value}'`
    )
    optionLines.push(`  headers: {\n${headerLines.join(',\n')}\n  }`)
  }
  optionLines.push(`  body: ${buildFetchBodyExpression(request, query)}`)
  return [
    `const response = await fetch('${absoluteEndpointUrl(request.endpoint)}', {`,
    optionLines.join(',\n'),
    '})',
    '',
    'const data = await response.json()'
  ].join('\n')
}

const PYTHON_TRIPLE_QUOTE = "'''"

const buildPythonDataArgument = (
  request: CopyRequestDescriptor,
  query: string
) => {
  if (request.bodyMode === 'json') {
    return `json={'query': ${JSON.stringify(query)}}`
  }
  if (query.includes(PYTHON_TRIPLE_QUOTE) || query.endsWith("'")) {
    return `data=${JSON.stringify(query)}`
  }
  return `data='''${query.replaceAll('\\', '\\\\')}'''`
}

const buildPythonSnippet = ({ request, query }: BuildSnippetInput) => {
  const argumentLines = [`    '${absoluteEndpointUrl(request.endpoint)}'`]
  if (request.bodyMode === 'raw') {
    const headerEntries = Object.entries(request.headers ?? {})
    if (headerEntries.length > 0) {
      const headerLines = headerEntries.map(
        ([key, value]) => `        '${key}': '${value}'`
      )
      argumentLines.push(`    headers={\n${headerLines.join(',\n')}\n    }`)
    }
  }
  argumentLines.push(`    ${buildPythonDataArgument(request, query)}`)
  return [
    'import requests',
    '',
    `response = requests.post(\n${argumentLines.join(',\n')}\n)`,
    '',
    'response.raise_for_status()',
    'data = response.json()'
  ].join('\n')
}

export const COPY_SNIPPET_ACTIONS: CopySnippetAction[] = [
  { id: 'url', label: 'Copy URL', build: buildUrlSnippet },
  { id: 'curl', label: 'Copy as cURL', build: buildCurlSnippet },
  {
    id: 'powershell',
    label: 'Copy as PowerShell',
    build: buildPowerShellSnippet
  },
  { id: 'fetch', label: 'Copy as fetch', build: buildFetchSnippet },
  { id: 'python', label: 'Copy as Python requests', build: buildPythonSnippet }
]
