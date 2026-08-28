import crypto from 'node:crypto'
import { PassThrough, Readable } from 'node:stream'
import type { ReadableStream as ReadableStreamWeb } from 'node:stream/web'
import { type Archiver, ZipArchive } from 'archiver'
import type { NextRequest } from 'next/server'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'
import { getVirtuosoConfig } from '@/providers/virtuoso/config'
import { getSessionFromRequest } from '@/providers/virtuoso/request-auth'

const EXPORTS_SUBDIRECTORY = 'exports'
const MAX_FILE_SEGMENTS = 1024

const EXPORT_FORMATS: Record<
  string,
  {
    procedure: string
    extension: string
    contentType: string
    label: string
  }
> = {
  'application/ld+json': {
    procedure: 'dump_one_graph_ldjson',
    extension: 'jsonld',
    contentType: 'application/ld+json',
    label: 'JSON-LD'
  },
  'text/turtle': {
    procedure: 'dump_one_graph_ttl',
    extension: 'ttl',
    contentType: 'text/turtle',
    label: 'Turtle'
  },
  'application/n-triples': {
    procedure: 'dump_one_graph_nt',
    extension: 'nt',
    contentType: 'application/n-triples',
    label: 'N-Triples'
  },
  'application/n-quads': {
    procedure: 'dump_one_graph_nq',
    extension: 'nq',
    contentType: 'application/n-quads',
    label: 'N-Quads'
  },
  'application/rdf+xml': {
    procedure: 'dump_one_graph_rdfxml',
    extension: 'rdf',
    contentType: 'application/rdf+xml',
    label: 'RDF/XML'
  }
}

interface BridgeFileEntry {
  name: string
  relativePath: string
  size: number
}

interface ExportArtifact {
  graph: string
  displayName: string
  files: BridgeFileEntry[]
  extension: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''")
}

function slugify(value: string, fallback: string): string {
  const lastSegment = value.split(/[/#]/).filter(Boolean).pop() || fallback
  const sanitized = lastSegment
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return sanitized || fallback
}

function sanitizeFilename(input: string | null, fallback: string): string {
  if (!input) return fallback
  const cleaned = input
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  return cleaned || fallback
}

function buildVirtuosoPrefix(baseName: string): string {
  const basePath =
    getVirtuosoConfig().VIRTUOSO_EXPORT_BASE_PATH || './imports/exports'
  const normalizedBase = basePath.replace(/\\/g, '/').replace(/\/+$/, '')
  return `${normalizedBase}/${baseName}`
}

async function runVirtuosoDump(
  graph: string,
  procedure: string,
  virtPrefix: string,
  limit: number,
  authToken: string
): Promise<void> {
  const query = `${procedure}('${escapeSqlLiteral(graph)}', '${escapeSqlLiteral(virtPrefix)}', ${limit})`
  const response = await fetch(
    `${getVirtuosoConfig().VIRTUOSO_ADAPTER_URL}/api/query/sql`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ query })
    }
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      body || `Virtuoso export failed with status ${response.status}`
    )
  }
}

async function listArtifacts(
  basePrefix: string,
  extensionWithGzip: string,
  authToken: string
): Promise<BridgeFileEntry[]> {
  const params = new URLSearchParams()
  params.set('subdir', EXPORTS_SUBDIRECTORY)
  params.set('prefix', basePrefix)
  params.set('extension', extensionWithGzip.replace(/^\.+/, ''))

  const response = await fetch(
    `${getVirtuosoConfig().VIRTUOSO_ADAPTER_URL}/api/files?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    }
  )
  if (!response.ok) {
    const message = await response.text()
    throw new Error(
      message || `Failed to list exported files (${response.status})`
    )
  }

  const data = (await response.json()) as { files?: BridgeFileEntry[] }
  return Array.isArray(data.files) ? data.files : []
}

async function collectArtifacts(
  basePrefix: string,
  extension: string,
  authToken: string
): Promise<BridgeFileEntry[]> {
  const extensionWithGzip = `${extension}.gz`

  const config = getVirtuosoConfig()
  const pollAttempts = config.GRAPH_EXPORT_POLL_ATTEMPTS ?? 60
  const pollIntervalMs = config.GRAPH_EXPORT_POLL_INTERVAL_MS ?? 1000

  for (let attempt = 0; attempt < pollAttempts; attempt++) {
    const files = await listArtifacts(basePrefix, extensionWithGzip, authToken)

    if (files.length > 0) {
      const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name))
      const ordered: BridgeFileEntry[] = []

      for (let idx = 1; idx <= MAX_FILE_SEGMENTS; idx++) {
        const candidate = `${basePrefix}${idx.toString().padStart(6, '0')}.${extension}.gz`
        const match = sorted.find((file) => file.name === candidate)
        if (!match) {
          break
        }
        ordered.push(match)
      }

      if (ordered.length > 0) {
        return ordered
      }
    }

    await sleep(pollIntervalMs)
  }

  throw new Error(
    `Virtuoso did not produce any export files for prefix ${basePrefix}`
  )
}

async function downloadFileStream(
  relativePath: string,
  decompress = false,
  authToken: string
): Promise<ReadableStream<Uint8Array>> {
  const params = new URLSearchParams()
  params.set('path', relativePath)
  if (decompress) {
    params.set('decompress', '1')
  }

  const response = await fetch(
    `${getVirtuosoConfig().VIRTUOSO_ADAPTER_URL}/api/files/download?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    }
  )
  if (!response.ok || !response.body) {
    const message = await response.text()
    throw new Error(message || `Failed to download artifact ${relativePath}`)
  }

  return response.body
}

async function cleanupArtifacts(
  paths: string[],
  authToken: string
): Promise<void> {
  const unique = Array.from(new Set(paths)).filter(Boolean)
  if (unique.length === 0) return

  try {
    await fetch(`${getVirtuosoConfig().VIRTUOSO_ADAPTER_URL}/api/files`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ paths: unique })
    })
  } catch (error) {
    console.warn('Failed to delete export artifacts', error)
  }
}

function createSingleGraphStream(
  artifact: ExportArtifact,
  authToken: string
): ReadableStream<Uint8Array> {
  const cleanupTargets = artifact.files.map((file) => file.relativePath)

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const file of artifact.files) {
          const stream = await downloadFileStream(
            file.relativePath,
            true,
            authToken
          )
          const reader = stream.getReader()

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value) controller.enqueue(value)
          }
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      } finally {
        await cleanupArtifacts(cleanupTargets, authToken)
      }
    }
  })
}

function appendStreamToArchive(
  archiveInstance: Archiver,
  stream: Readable,
  entryName: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.on('end', () => resolve())
    stream.on('error', (error) => reject(error))
    archiveInstance.append(stream, { name: entryName })
  })
}

function createZipStream(
  artifacts: ExportArtifact[],
  authToken: string
): ReadableStream<Uint8Array> {
  const archive = new ZipArchive({ zlib: { level: 9 } })
  const passThrough = new PassThrough()
  const stream = Readable.toWeb(passThrough) as ReadableStream<Uint8Array>
  const cleanupTargets = artifacts.flatMap((artifact) =>
    artifact.files.map((file) => file.relativePath)
  )

  archive.on('warning', (warning) => {
    console.warn('Archive warning during graph export', warning)
  })

  archive.on('error', (err) => {
    passThrough.destroy(err)
  })

  archive.pipe(passThrough)

  ;(async () => {
    try {
      for (const artifact of artifacts) {
        let segment = 1
        for (const file of artifact.files) {
          const remoteStream = await downloadFileStream(
            file.relativePath,
            true,
            authToken
          )
          const nodeStream = Readable.fromWeb(
            remoteStream as ReadableStreamWeb<Uint8Array>
          )
          const entryName = `${artifact.displayName}${
            artifact.files.length > 1 ? `_${segment}` : ''
          }.${artifact.extension}`
          await appendStreamToArchive(archive, nodeStream, entryName)
          segment += 1
        }
      }

      await archive.finalize()
    } catch (error) {
      archive.destroy(error as Error)
      passThrough.destroy(error as Error)
    } finally {
      await cleanupArtifacts(cleanupTargets, authToken)
    }
  })().catch((error) => {
    passThrough.destroy(error)
  })

  return stream
}

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return sameOriginError()
  const defaultFileLengthLimit =
    getVirtuosoConfig().GRAPH_EXPORT_FILE_LIMIT ?? 50_000_000_000
  const session = await getSessionFromRequest(request)
  if (!session) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401
    })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format')
    const graphParams = searchParams.getAll('graph')
    const filename = searchParams.get('filename')
    const limitParam = searchParams.get('fileLengthLimit')

    const graphs = Array.from(
      new Set(
        graphParams
          .flatMap((param) => param.split(','))
          .map((value) => value.trim())
          .filter(Boolean)
      )
    )

    if (graphs.length === 0) {
      return new Response(JSON.stringify({ error: 'No graph URIs provided' }), {
        status: 400
      })
    }

    if (!format) {
      return new Response(JSON.stringify({ error: 'No format provided' }), {
        status: 400
      })
    }

    const formatConfig = EXPORT_FORMATS[format]

    if (!formatConfig) {
      return new Response(JSON.stringify({ error: 'Unsupported format' }), {
        status: 400
      })
    }

    const fileLengthLimit = limitParam
      ? Number(limitParam)
      : defaultFileLengthLimit
    const effectiveLimit =
      Number.isFinite(fileLengthLimit) && fileLengthLimit > 0
        ? fileLengthLimit
        : defaultFileLengthLimit

    const artifacts: ExportArtifact[] = []
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '')

    for (let index = 0; index < graphs.length; index++) {
      const graphIri = graphs[index]
      const safeGraphName = slugify(graphIri, `graph-${index + 1}`)
      const uniqueSuffix = crypto.randomBytes(4).toString('hex')
      const basePrefix = `${timestamp}_${index + 1}_${uniqueSuffix}_`
      const virtPrefix = buildVirtuosoPrefix(basePrefix)

      await runVirtuosoDump(
        graphIri,
        formatConfig.procedure,
        virtPrefix,
        effectiveLimit,
        session.token
      )
      const files = await collectArtifacts(
        basePrefix,
        formatConfig.extension,
        session.token
      )

      if (files.length === 0) {
        throw new Error(`No export artifacts were generated for ${graphIri}`)
      }

      artifacts.push({
        graph: graphIri,
        displayName: safeGraphName,
        files,
        extension: formatConfig.extension
      })
    }

    const downloadBaseName = sanitizeFilename(
      filename,
      artifacts.length === 1 ? artifacts[0].displayName : `graphs-${timestamp}`
    )

    if (artifacts.length === 1) {
      const singleBody = createSingleGraphStream(artifacts[0], session.token)
      const singleHeaders = new Headers()
      singleHeaders.set('Content-Type', formatConfig.contentType)
      singleHeaders.set(
        'Content-Disposition',
        `attachment; filename="${downloadBaseName}.${artifacts[0].extension}"`
      )
      return new Response(singleBody, { status: 200, headers: singleHeaders })
    }

    const zipBody = createZipStream(artifacts, session.token)
    const zipHeaders = new Headers()
    zipHeaders.set('Content-Type', 'application/zip')
    zipHeaders.set(
      'Content-Disposition',
      `attachment; filename="${downloadBaseName}.zip"`
    )
    return new Response(zipBody, { status: 200, headers: zipHeaders })
  } catch (error: unknown) {
    console.error('Graph export failed', error)
    return new Response(
      JSON.stringify({
        error: 'Graph export failed',
        message: (error as Error).message
      }),
      {
        status: 500
      }
    )
  }
}
