'use client'

import { Loader2Icon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import {
  importFileAction,
  importSnippetAction,
  importUrlAction
} from '@/app/actions/oxigraph-import'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

const FILE_FORMATS = [
  { id: 'auto', label: 'Auto-detect' },
  { id: 'text/turtle', label: 'Turtle (.ttl)' },
  { id: 'application/n-triples', label: 'N-Triples (.nt)' },
  { id: 'application/rdf+xml', label: 'RDF/XML (.rdf)' },
  { id: 'application/n-quads', label: 'N-Quads (.nq)' },
  { id: 'application/trig', label: 'TriG (.trig)' }
] as const

const EXTENSION_FORMATS: Record<string, string> = {
  ttl: 'text/turtle',
  turtle: 'text/turtle',
  nt: 'application/n-triples',
  ntriples: 'application/n-triples',
  rdf: 'application/rdf+xml',
  xml: 'application/rdf+xml',
  nq: 'application/n-quads',
  trig: 'application/trig'
}

function resolveFormat(file: File, selected: string): string {
  if (selected !== 'auto') return selected
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_FORMATS[extension] ?? 'text/turtle'
}

function run<T extends { ok: boolean; message: string }>(
  action: Promise<T>,
  setPending: (value: boolean) => void
): void {
  setPending(true)
  action
    .then((result) => {
      if (result.ok) toast.success(result.message)
      else toast.error(result.message)
    })
    .catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'The import failed')
    })
    .finally(() => setPending(false))
}

function GraphField({
  value,
  onChange,
  placeholder = 'http://example.org/graph'
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="target-graph">Target graph (optional)</Label>
      <Input
        id="target-graph"
        type="url"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <p className="text-muted-foreground text-xs">
        Required for Turtle, N-Triples, and RDF/XML. N-Quads and TriG carry
        their own graph information.
      </p>
    </div>
  )
}

export default function OxigraphImportManager() {
  const [pending, setPending] = useState(false)
  const [format, setFormat] = useState<string>('auto')
  const [graph, setGraph] = useState('')
  const [url, setUrl] = useState('')
  const [snippet, setSnippet] = useState('')
  const [file, setFile] = useState<File | null>(null)

  function submitFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) {
      toast.error('Choose a file to import')
      return
    }
    const targetGraph = graph.trim() || undefined
    run(
      importFileAction(file, resolveFormat(file, format), targetGraph),
      setPending
    )
  }

  function submitUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!url.trim()) {
      toast.error('Enter a URL to load')
      return
    }
    run(importUrlAction(url.trim(), graph.trim() || undefined), setPending)
  }

  function submitSnippet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!snippet.trim()) {
      toast.error('Paste some Turtle to import')
      return
    }
    run(importSnippetAction(snippet, graph.trim() || undefined), setPending)
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Import Data"
        text="Load RDF into Oxigraph through the Graph Store HTTP protocol"
      />
      <Tabs defaultValue="file">
        <TabsList>
          <TabsTrigger value="file">File</TabsTrigger>
          <TabsTrigger value="url">URL</TabsTrigger>
          <TabsTrigger value="snippet">Snippet</TabsTrigger>
        </TabsList>

        <TabsContent value="file">
          <Card>
            <CardHeader>
              <CardTitle>Upload a file</CardTitle>
              <CardDescription>
                Turtle, N-Triples, RDF/XML, N-Quads, and TriG are supported.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitFile} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="rdf-file">RDF file</Label>
                  <Input
                    id="rdf-file"
                    type="file"
                    accept=".ttl,.nt,.rdf,.xml,.nq,.trig"
                    onChange={(event) =>
                      setFile(event.target.files?.[0] ?? null)
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rdf-format">Format</Label>
                  <Select value={format} onValueChange={setFormat}>
                    <SelectTrigger id="rdf-format">
                      <SelectValue placeholder="Format" />
                    </SelectTrigger>
                    <SelectContent>
                      {FILE_FORMATS.map((entry) => (
                        <SelectItem key={entry.id} value={entry.id}>
                          {entry.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <GraphField value={graph} onChange={setGraph} />
                <Button type="submit" disabled={pending || !file}>
                  {pending && <Loader2Icon className="animate-spin" />}
                  Import file
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="url">
          <Card>
            <CardHeader>
              <CardTitle>Load from a URL</CardTitle>
              <CardDescription>
                Runs a SPARQL LOAD against the endpoint. Turtle, N-Triples, and
                RDF/XML sources are supported.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitUrl} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="rdf-url">Source URL</Label>
                  <Input
                    id="rdf-url"
                    type="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://example.org/data.ttl"
                  />
                </div>
                <GraphField value={graph} onChange={setGraph} />
                <Button type="submit" disabled={pending || !url.trim()}>
                  {pending && <Loader2Icon className="animate-spin" />}
                  Load URL
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="snippet">
          <Card>
            <CardHeader>
              <CardTitle>Paste Turtle</CardTitle>
              <CardDescription>Insert a small Turtle snippet.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitSnippet} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="rdf-snippet">Turtle</Label>
                  <Textarea
                    id="rdf-snippet"
                    value={snippet}
                    onChange={(event) => setSnippet(event.target.value)}
                    rows={8}
                    placeholder="@prefix ex: <http://example.org/> . ex:alice a ex:Person ."
                    className="font-mono text-xs"
                  />
                </div>
                <GraphField value={graph} onChange={setGraph} />
                <Button type="submit" disabled={pending || !snippet.trim()}>
                  {pending && <Loader2Icon className="animate-spin" />}
                  Import snippet
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardShell>
  )
}
