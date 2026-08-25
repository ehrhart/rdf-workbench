'use client'

import {
  AlertTriangle,
  Check,
  FileText,
  Link2,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  X
} from 'lucide-react'
import Link from 'next/link'
import { ChunkUploader } from 'nextjs-chunk-upload-action'
import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { toast } from 'sonner'
import { chunkUploadAction } from '@/app/actions/chunk-upload'
import { cleanupStaleUploads } from '@/app/actions/upload-cleanup'
import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { tryCatch } from '@/lib/result'
import { cn } from '@/lib/utils'
import type {
  BulkLoadJob,
  BulkLoadJobApiPayload,
  BulkLoadJobsResponse,
  BulkLoadRequest,
  BulkLoadTriggerResponse,
  ImportStatus,
  MutationSuccessResponse,
  UploadResponse
} from '@/types/import'

const RDF_FORMATS = [
  { id: 'ttl', label: 'Turtle (.ttl)', extension: '.ttl' },
  { id: 'nt', label: 'N-Triples (.nt)', extension: '.nt' },
  { id: 'rdf', label: 'RDF/XML (.rdf)', extension: '.rdf' },
  { id: 'jsonld', label: 'JSON-LD (.jsonld)', extension: '.jsonld' },
  { id: 'trig', label: 'TriG (.trig)', extension: '.trig' }
] as const

type RdfFormatId = (typeof RDF_FORMATS)[number]['id']
type ImportJob = BulkLoadJob

const isImportStatus = (value: unknown): value is ImportStatus =>
  value === 'queued' ||
  value === 'in-progress' ||
  value === 'completed' ||
  value === 'failed'

const extractFilename = (value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0) {
    return ''
  }

  const segments = value.split(/[\\/]/)
  const basename = segments.pop()

  if (!basename || basename.length === 0) {
    return value
  }

  return basename
}

const resolveExtensionForFormat = (
  formatId?: RdfFormatId | 'auto'
): string | undefined => {
  if (!formatId || formatId === 'auto') {
    return undefined
  }

  return RDF_FORMATS.find((format) => format.id === formatId)?.extension
}

const extractMessage = (payload: unknown, fallback: string): string => {
  if (payload && typeof payload === 'object') {
    const maybeRecord = payload as Record<string, unknown>

    if (typeof maybeRecord.error === 'string' && maybeRecord.error.length > 0) {
      return maybeRecord.error
    }

    if (
      typeof maybeRecord.message === 'string' &&
      maybeRecord.message.length > 0
    ) {
      return maybeRecord.message
    }
  }

  return fallback
}

function readJsonOrThrow<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  return response.json().then((data) => {
    if (!response.ok) {
      const errorMessage = extractMessage(
        data,
        `Request failed with status ${response.status}. ${fallbackMessage}`
      )
      throw new Error(errorMessage)
    }
    return data as T
  })
}

const deriveStatus = (job: BulkLoadJobApiPayload): ImportStatus => {
  if (job.status && isImportStatus(job.status)) {
    return job.status
  }

  const state =
    typeof job?.state === 'number'
      ? job.state
      : typeof job?.ll_state === 'number'
        ? job.ll_state
        : undefined

  switch (state) {
    case 0:
      return 'queued'
    case 1:
      return 'in-progress'
    case 2:
      return 'completed'
    case 3:
      return 'failed'
    default:
      return 'queued'
  }
}

const normalizeJob = (job: BulkLoadJobApiPayload): ImportJob => {
  const rawFilename = job?.filename ?? job?.ll_file ?? ''
  const filename = extractFilename(rawFilename)
  const graphIri = job?.graphIri ?? job?.ll_graph ?? ''
  const started = job?.started ?? job?.startTime ?? job?.ll_started ?? null
  const done = job?.done ?? job?.endTime ?? job?.ll_done ?? null
  const workTime =
    typeof job?.workTime === 'number'
      ? job.workTime
      : typeof job?.ll_work_time === 'number'
        ? job.ll_work_time
        : null
  const jobId = job?.jobId ?? `${filename || rawFilename}|${graphIri}`

  return {
    jobId: jobId || `${filename || rawFilename}|${graphIri}`,
    filename: filename || rawFilename || '',
    graphIri,
    status: deriveStatus(job),
    started,
    done,
    workTime,
    message: typeof job?.message === 'string' ? job.message : null,
    error:
      typeof job?.error === 'string'
        ? job.error
        : typeof job?.ll_error === 'string'
          ? job.ll_error
          : null
  }
}

const formatTimestamp = (value?: string | null): string => {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleString()
}

const calculateDurationSeconds = (job: ImportJob): number | null => {
  if (typeof job.workTime === 'number') {
    return job.workTime
  }

  if (!job.started || !job.done) {
    return null
  }

  const start = new Date(job.started).getTime()
  const end = new Date(job.done).getTime()

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null
  }

  return Math.max(0, (end - start) / 1000)
}

const formatDuration = (seconds: number): string =>
  seconds < 1 ? '< 1s' : `${seconds.toFixed(1)}s`

const getJobMessage = (job: ImportJob): string | null =>
  job.error && job.error.length > 0
    ? job.error
    : job.message && job.message.length > 0
      ? job.message
      : null

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<'file' | 'url' | 'snippet'>('file')
  const [jobs, setJobs] = useState<ImportJob[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileGraphIri, setFileGraphIri] = useState('')
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  const [sourceUrl, setSourceUrl] = useState('')
  const [urlGraphIri, setUrlGraphIri] = useState('')
  const [urlFormat, setUrlFormat] = useState<RdfFormatId | 'auto'>('auto')
  const [urlLoading, setUrlLoading] = useState(false)

  const [snippetContent, setSnippetContent] = useState('')
  const [snippetGraphIri, setSnippetGraphIri] = useState('')
  const [snippetFormat, setSnippetFormat] = useState<RdfFormatId>('ttl')
  const [snippetLoading, setSnippetLoading] = useState(false)

  const fetchJobs = useCallback(async () => {
    const result = await tryCatch(async () => {
      const response = await fetch('/api/import')
      return readJsonOrThrow<BulkLoadJobsResponse>(
        response,
        'Failed to fetch import jobs.'
      )
    })

    if (!result.success) {
      console.warn('Error fetching import jobs:', result.error)
      return
    }

    const rawJobs = Array.isArray(result.data.jobs) ? result.data.jobs : []
    setJobs(rawJobs.map((job) => normalizeJob(job)))
  }, [])

  useEffect(() => {
    void fetchJobs()
    const interval = window.setInterval(() => {
      void fetchJobs()
    }, 5000)

    return () => window.clearInterval(interval)
  }, [fetchJobs])

  useEffect(() => {
    void cleanupStaleUploads()
  }, [])

  const sortedJobs = useMemo(
    () =>
      [...jobs].sort((a, b) => {
        const aTime = a.started ? new Date(a.started).getTime() : 0
        const bTime = b.started ? new Date(b.started).getTime() : 0
        return bTime - aTime
      }),
    [jobs]
  )

  const queueBulkLoad = useCallback(async (payload: BulkLoadRequest) => {
    const loadResponse = await fetch('/api/import/bulk-load', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    return readJsonOrThrow<BulkLoadTriggerResponse>(
      loadResponse,
      'Failed to start bulk load.'
    )
  }, [])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
    }
  }

  const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDragOver(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDragOver(false)
  }

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDragOver(false)

    const droppedFile = event.dataTransfer.files?.[0]
    if (droppedFile) {
      setFile(droppedFile)
    }
  }

  const handleFileUpload = async () => {
    if (!file) {
      toast.error('Please select a file to upload.')
      return
    }

    if (!fileGraphIri.trim()) {
      toast.error('Please specify a target graph IRI.')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    const uploader = new ChunkUploader({
      file,
      onChunkUpload: chunkUploadAction,
      metadata: { name: file.name, totalSize: file.size },
      onChunkComplete: (bytesAccepted, bytesTotal) => {
        const progress = Math.round((bytesAccepted / bytesTotal) * 100)
        setUploadProgress(progress)
      },
      onError: (error) => {
        console.error('Chunk upload error:', error)
        const err = error as Error
        toast.error(err.message || 'Failed to upload file')
        setUploading(false)
        setProcessing(false)
        setUploadProgress(0)
      },
      onSuccess: async () => {
        try {
          // After chunks are uploaded, forward the file to the Virtuoso adapter
          setProcessing(true)
          const completeResponse = await fetch('/api/import/complete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filename: file.name })
          })

          const uploadData = await readJsonOrThrow<UploadResponse>(
            completeResponse,
            'Failed to complete upload.'
          )
          const savedFilename = uploadData.filename || file.name

          toast.success(`Uploaded ${savedFilename}`)

          await queueBulkLoad({
            filename: savedFilename,
            graphIri: fileGraphIri
          })
          toast.success('Bulk load job queued successfully.')

          setFile(null)
          setFileGraphIri('')
          setUploadProgress(0)
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }

          await fetchJobs()
        } catch (error) {
          const err = error as Error
          console.error('Error completing upload:', err)
          toast.error(err.message || 'Failed to complete upload.')
        } finally {
          setUploading(false)
          setProcessing(false)
        }
      }
    })

    uploader.start()
  }

  const handleUrlImport = async () => {
    if (!sourceUrl.trim()) {
      toast.error('Please provide a source URL.')
      return
    }

    if (!urlGraphIri.trim()) {
      toast.error('Please specify a target graph IRI.')
      return
    }

    setUrlLoading(true)

    const result = await tryCatch(async () => {
      const payload = {
        url: sourceUrl.trim(),
        extension: resolveExtensionForFormat(urlFormat)
      }

      const response = await fetch('/api/import/url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await readJsonOrThrow<UploadResponse>(
        response,
        'Failed to import from URL.'
      )
      const savedFilename = data.filename || extractFilename(payload.url)

      toast.success(`Fetched RDF from URL.`)

      await queueBulkLoad({ filename: savedFilename, graphIri: urlGraphIri })
      return savedFilename
    })

    if (!result.success) {
      const err = result.error as Error
      console.error('Error importing from URL:', err)
      toast.error(err.message || 'Failed to import from URL.')
    } else {
      toast.success('Bulk load job queued successfully.')
      setSourceUrl('')
      setUrlGraphIri('')
      setUrlFormat('auto')
      await fetchJobs()
    }

    setUrlLoading(false)
  }

  const handleSnippetImport = async () => {
    if (!snippetContent.trim()) {
      toast.error('Please paste an RDF snippet to import.')
      return
    }

    if (!snippetGraphIri.trim()) {
      toast.error('Please specify a target graph IRI.')
      return
    }

    setSnippetLoading(true)

    const result = await tryCatch(async () => {
      const payload = {
        content: snippetContent,
        extension: resolveExtensionForFormat(snippetFormat)
      }

      const response = await fetch('/api/import/snippet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await readJsonOrThrow<UploadResponse>(
        response,
        'Failed to save RDF snippet.'
      )
      const savedFilename =
        data.filename ||
        `snippet${resolveExtensionForFormat(snippetFormat) ?? '.ttl'}`

      toast.success(`Saved RDF snippet.`)

      await queueBulkLoad({
        filename: savedFilename,
        graphIri: snippetGraphIri
      })
      return savedFilename
    })

    if (!result.success) {
      const err = result.error as Error
      console.error('Error importing snippet:', err)
      toast.error(err.message || 'Failed to import snippet.')
    } else {
      toast.success('Bulk load job queued successfully.')
      setSnippetContent('')
      setSnippetGraphIri('')
      await fetchJobs()
    }

    setSnippetLoading(false)
  }

  const handleCancelJob = useCallback(
    async (jobId: string) => {
      const result = await tryCatch(async () => {
        const response = await fetch('/api/import/cancel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ jobId })
        })

        await readJsonOrThrow<MutationSuccessResponse>(
          response,
          'Failed to cancel job.'
        )
      })

      if (!result.success) {
        const err = result.error as Error
        console.error('Error cancelling job:', err)
        toast.error(err.message || 'Failed to cancel job.')
      } else {
        toast.success('Job cancelled successfully.')
        await fetchJobs()
      }
    },
    [fetchJobs]
  )

  const handleDeleteFile = useCallback(
    async (filename: string) => {
      if (!filename) {
        toast.error('Filename unavailable for deletion.')
        return
      }

      const result = await tryCatch(async () => {
        const response = await fetch(
          `/api/import?filename=${encodeURIComponent(filename)}`,
          {
            method: 'DELETE'
          }
        )

        await readJsonOrThrow<MutationSuccessResponse>(
          response,
          'Failed to delete file.'
        )
      })

      if (!result.success) {
        const err = result.error as Error
        console.error('Error deleting file:', err)
        toast.error(err.message || 'Failed to delete file.')
      } else {
        toast.success('File deleted successfully.')
        await fetchJobs()
      }
    },
    [fetchJobs]
  )

  return (
    <DashboardShell>
      <DashboardHeader
        heading="RDF Data Import"
        text="Use the Virtuoso Bulk RDF Loader to ingest RDF datasets from files, remote URLs, or inline snippets."
      />
      <div className="flex flex-col gap-4">
        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as 'file' | 'url' | 'snippet')
          }
        >
          <TabsList className="grid w-full gap-2 md:w-[640px] md:grid-cols-3 mb-0">
            <TabsTrigger
              value="file"
              className="flex items-center gap-2 truncate"
            >
              <Upload className="h-4 w-4" />
              <span>Upload File</span>
            </TabsTrigger>
            <TabsTrigger
              value="url"
              className="flex items-center gap-2 truncate"
            >
              <Link2 className="h-4 w-4" />
              <span>Fetch from URL</span>
            </TabsTrigger>
            <TabsTrigger
              value="snippet"
              className="flex items-center gap-2 truncate"
            >
              <FileText className="h-4 w-4" />
              <span>Paste Snippet</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Upload RDF File</CardTitle>
                <CardDescription>
                  Drag and drop a file or browse your computer. Supported
                  formats include Turtle, TriG, N-Triples, RDF/XML, JSON-LD, and
                  compressed archives.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-6"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleFileUpload()
                  }}
                >
                  <button
                    type="button"
                    className={cn(
                      'flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors',
                      dragOver
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted-foreground/30 bg-muted/20 hover:border-primary/50'
                    )}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <input
                      ref={fileInputRef}
                      id="file-upload"
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                      accept=".rdf,.owl,.ttl,.nt,.n3,.nq,.trig,.xml,.gz,.bz2,.xz"
                    />
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {file
                          ? file.name
                          : 'Drop an RDF file or click to browse'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Large files supported via chunked upload
                      </p>
                    </div>
                  </button>

                  {file && (
                    <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                      <span className="truncate" title={file.name}>
                        {file.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFile(null)}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="file-graph-iri">Target Graph IRI</Label>
                    <Input
                      id="file-graph-iri"
                      placeholder="http://example.org/graph"
                      value={fileGraphIri}
                      onChange={(event) => setFileGraphIri(event.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    disabled={!file || !fileGraphIri.trim() || uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {processing
                          ? 'Processing…'
                          : uploadProgress > 0
                            ? `Uploading ${uploadProgress}%`
                            : 'Uploading…'}
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload &amp; Import
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Fetch RDF from URL</CardTitle>
                <CardDescription>
                  Download RDF directly from an HTTP(S) endpoint and queue it
                  for bulk loading.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-6"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleUrlImport()
                  }}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="source-url">Source URL</Label>
                      <Input
                        id="source-url"
                        type="url"
                        placeholder="https://example.org/dataset.ttl"
                        value={sourceUrl}
                        onChange={(event) => setSourceUrl(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="url-graph-iri">Target Graph IRI</Label>
                      <Input
                        id="url-graph-iri"
                        placeholder="http://example.org/graph"
                        value={urlGraphIri}
                        onChange={(event) => setUrlGraphIri(event.target.value)}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    disabled={
                      !sourceUrl.trim() || !urlGraphIri.trim() || urlLoading
                    }
                  >
                    {urlLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Fetching…
                      </>
                    ) : (
                      <>
                        <Link2 className="mr-2 h-4 w-4" />
                        Fetch &amp; Import
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="snippet" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Import RDF Snippet</CardTitle>
                <CardDescription>
                  Paste an RDF fragment, choose a format, and queue it for
                  loading.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-6"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleSnippetImport()
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="snippet-content">RDF Content</Label>
                    <Textarea
                      id="snippet-content"
                      placeholder={
                        '@prefix ex: <http://example.org/> .\nex:Alice a ex:Person .'
                      }
                      rows={10}
                      value={snippetContent}
                      onChange={(event) =>
                        setSnippetContent(event.target.value)
                      }
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {snippetContent.length.toLocaleString()} characters
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="snippet-graph-iri">
                        Target Graph IRI
                      </Label>
                      <Input
                        id="snippet-graph-iri"
                        placeholder="http://example.org/graph"
                        value={snippetGraphIri}
                        onChange={(event) =>
                          setSnippetGraphIri(event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="snippet-format">Format</Label>
                      <Select
                        value={snippetFormat}
                        onValueChange={(value) =>
                          setSnippetFormat(value as RdfFormatId)
                        }
                      >
                        <SelectTrigger id="snippet-format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RDF_FORMATS.map((format) => (
                            <SelectItem key={format.id} value={format.id}>
                              {format.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    disabled={
                      !snippetContent.trim() ||
                      !snippetGraphIri.trim() ||
                      snippetLoading
                    }
                  >
                    {snippetLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing…
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Save &amp; Import
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle>Import Jobs</CardTitle>
              <CardDescription>
                Monitor the status of your bulk load jobs.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchJobs()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {sortedJobs.length === 0 ? (
              <div className="rounded-md border border-dashed border-muted-foreground/40 py-8 text-center text-sm text-muted-foreground">
                No import jobs yet. Start an import above to see progress here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Filename</TableHead>
                      <TableHead>Graph IRI</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="whitespace-normal">
                        Details
                      </TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Finished</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs text-muted-foreground">
                    {sortedJobs.map((job) => {
                      const durationSeconds = calculateDurationSeconds(job)
                      const jobMessage = getJobMessage(job)

                      return (
                        <TableRow key={job.jobId}>
                          <TableCell
                            className="min-w-0 wrap-break-words"
                            title={job.filename || 'Unknown file'}
                          >
                            {job.filename || '—'}
                          </TableCell>
                          <TableCell
                            className="font-mono text-xs min-w-0 wrap-break-words"
                            title={job.graphIri || 'No graph specified'}
                          >
                            {job.graphIri ? (
                              <Link
                                href={`/resource?uri=${encodeURIComponent(job.graphIri)}&role=context`}
                                className="text-primary hover:underline"
                              >
                                {job.graphIri}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger className="p-2">
                                {job.status === 'in-progress' ? (
                                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                                ) : job.status === 'completed' ? (
                                  <Check className="size-4 text-emerald-500" />
                                ) : job.status === 'failed' ? (
                                  <AlertTriangle className="size-4 text-destructive" />
                                ) : (
                                  <RefreshCw className="size-4 text-muted-foreground" />
                                )}
                              </TooltipTrigger>
                              <TooltipContent>{job.status}</TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="min-w-0 whitespace-normal wrap-break-words">
                            <div className="text-xs text-muted-foreground">
                              {jobMessage || '—'}
                            </div>
                          </TableCell>
                          <TableCell className="min-w-0">
                            {formatTimestamp(job.started)}
                          </TableCell>
                          <TableCell className="min-w-0">
                            {formatTimestamp(job.done)}
                          </TableCell>
                          <TableCell className="min-w-0">
                            {durationSeconds !== null &&
                              formatDuration(durationSeconds)}
                          </TableCell>
                          <TableCell className="text-primary">
                            <div className="flex flex-wrap gap-2">
                              {(job.status === 'queued' ||
                                job.status === 'in-progress') && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    void handleCancelJob(job.jobId)
                                  }
                                >
                                  <X className="mr-1 h-4 w-4" />
                                  Cancel
                                </Button>
                              )}
                              {(job.status === 'completed' ||
                                job.status === 'failed') &&
                                job.filename && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      void handleDeleteFile(job.filename)
                                    }
                                  >
                                    <Trash2 className="mr-1 h-4 w-4" />
                                    Delete
                                  </Button>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
