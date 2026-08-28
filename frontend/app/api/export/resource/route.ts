import type { NextRequest } from 'next/server'
import { DEFAULT_SHOW_BLANK_NODES } from '@/components/resource-manager/constants'
import {
  RESOURCE_ROLES,
  type ResourceRole
} from '@/components/resource-manager/types'
import { getWorkbenchRuntime } from '@/lib/runtime'
import {
  buildBlankNodeFilterClause,
  buildRoleFilterClause
} from '@/lib/sparql/resource-filters'

export async function POST(request: NextRequest) {
  try {
    const runtime = await getWorkbenchRuntime()
    const supportedFormats = runtime.sparql.getDownloadFormats('construct')
    const defaultFormat = supportedFormats[0]
    if (!defaultFormat) {
      return Response.json(
        { error: 'Resource exports are unavailable for this provider' },
        { status: 404 }
      )
    }
    const searchParams = request.nextUrl.searchParams
    const resourceUri = searchParams.get('uri')
    const format = searchParams.get('format') ?? defaultFormat.mime
    const filenameParam = searchParams.get('filename') ?? 'resource'
    const role = parseRole(searchParams.get('role'))
    const showBlankNodesParam = searchParams.get('showBlankNodes')
    const showBlankNodes =
      showBlankNodesParam === null
        ? DEFAULT_SHOW_BLANK_NODES
        : showBlankNodesParam !== 'false'

    if (!resourceUri) {
      return new Response(
        JSON.stringify({ error: 'Missing URI for resource export' }),
        { status: 400 }
      )
    }

    if (resourceUri.includes('<') || resourceUri.includes('>')) {
      return new Response(
        JSON.stringify({ error: 'Invalid URI supplied for export' }),
        { status: 400 }
      )
    }

    const formatConfig = supportedFormats.find(
      (candidate) => candidate.mime === format
    )
    if (!formatConfig) {
      return new Response(
        JSON.stringify({ error: `Unsupported format: ${format}` }),
        { status: 400 }
      )
    }

    const query = createResourceConstructQuery({
      resourceUri,
      role,
      showBlankNodes
    })

    const response = await runtime.sparql.download(query, formatConfig.mime)

    if (!response.ok || !response.body) {
      return new Response(
        JSON.stringify({ error: (await response.text()) || 'Export failed' }),
        { status: 500 }
      )
    }

    const filename = `${sanitizeFilename(filenameParam)}.${formatConfig.extension}`

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': formatConfig.mime,
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error('Error exporting resource:', error)
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500
    })
  }
}

function createResourceConstructQuery({
  resourceUri,
  role,
  showBlankNodes
}: {
  resourceUri: string
  role: ResourceRole
  showBlankNodes: boolean
}) {
  const iri = `<${resourceUri}>`
  const roleClause = buildRoleFilterClause(role)
  const blankNodeClause = buildBlankNodeFilterClause(showBlankNodes)

  return `CONSTRUCT { ?subject ?predicate ?object }
WHERE {
  VALUES ?resource { ${iri} }
  GRAPH ?graph { ?subject ?predicate ?object }
  ${roleClause}
  ${blankNodeClause}
}`
}

function parseRole(roleParam: string | null): ResourceRole {
  if (!roleParam) {
    return 'all'
  }

  return (RESOURCE_ROLES as readonly string[]).includes(roleParam)
    ? (roleParam as ResourceRole)
    : 'all'
}

function sanitizeFilename(filename: string) {
  const normalized = filename
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (!normalized) {
    return 'resource'
  }

  return normalized.slice(0, 100)
}
