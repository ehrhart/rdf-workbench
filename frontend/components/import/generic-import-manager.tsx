'use client'

import { Loader2Icon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { importUrlAction } from '@/app/actions/generic-import'
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

export default function GenericImportManager() {
  const [pending, setPending] = useState(false)
  const [url, setUrl] = useState('')
  const [graph, setGraph] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!url.trim()) {
      toast.error('Enter a URL to load')
      return
    }
    setPending(true)
    importUrlAction(url.trim(), graph.trim() || undefined)
      .then((result) => {
        if (result.ok) toast.success(result.message)
        else toast.error(result.message)
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : 'The import failed'
        )
      })
      .finally(() => setPending(false))
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Import data"
        text="Load RDF into the endpoint from a URL."
      />
      <Card>
        <CardHeader>
          <CardTitle>Load from a URL</CardTitle>
          <CardDescription>
            The endpoint fetches and parses the source itself. Turtle,
            N-Triples, and RDF/XML usually work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="generic-rdf-url">Source URL</Label>
              <Input
                id="generic-rdf-url"
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.org/data.ttl"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="generic-target-graph">
                Target graph (optional)
              </Label>
              <Input
                id="generic-target-graph"
                type="url"
                value={graph}
                onChange={(event) => setGraph(event.target.value)}
                placeholder="http://example.org/graph"
              />
              <p className="text-muted-foreground text-xs">
                Loads into the default graph when empty.
              </p>
            </div>
            <Button type="submit" disabled={pending || !url.trim()}>
              {pending && <Loader2Icon className="animate-spin" />}
              Load URL
            </Button>
          </form>
        </CardContent>
      </Card>
    </DashboardShell>
  )
}
