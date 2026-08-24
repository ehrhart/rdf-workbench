'use client'

import { BracketsIcon, DownloadIcon, ExternalLinkIcon } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DEFAULT_ROLE, DEFAULT_SHOW_BLANK_NODES } from './constants'
import { ResourceHeader } from './ResourceHeader'
import { TriplesDataTable } from './TriplesDataTable'
import { type FileType, RESOURCE_ROLES, type ResourceRole } from './types'
import { useResourceData } from './useResourceData'

/**
 * Main Resource Manager Component
 *
 * Displays comprehensive information about an RDF resource including:
 * - Resource metadata (label, comment, types)
 * - Triples where the resource appears in different roles
 * - Filtering and export capabilities
 */
export default function ResourceManager({
  fileTypes,
  uri: uriProp = null
}: {
  fileTypes: readonly FileType[]
  uri?: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Derive all state from URL parameters (single source of truth), falling
  // back to the IRI supplied directly for dereferenced resource URLs.
  const queryUri = useMemo(() => searchParams.get('uri'), [searchParams])
  const uri = uriProp ?? queryUri

  const role = useMemo(() => {
    const roleParam = searchParams.get('role')
    return RESOURCE_ROLES.includes(roleParam as ResourceRole)
      ? (roleParam as ResourceRole)
      : DEFAULT_ROLE
  }, [searchParams])

  const showBlankNodes = useMemo(() => {
    const param = searchParams.get('showBlankNodes')
    return param === null ? DEFAULT_SHOW_BLANK_NODES : param !== 'false'
  }, [searchParams])

  // Fetch data using custom hook (all params derived from URL)
  const { status, error, resourceInfo, triplesStatus, triplesError, triples } =
    useResourceData(uri, role, showBlankNodes)

  // --- URL Update Helpers (stable references) ---

  const updateSearchParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([key, value]) => {
        params.set(key, value)
      })
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [searchParams, router, pathname]
  )

  // --- Event Handlers (stable references) ---

  const handleRoleChange = useCallback(
    (newRole: ResourceRole) => {
      if (role === newRole) return
      updateSearchParams({ role: newRole })
    },
    [role, updateSearchParams]
  )

  const handleToggleBlankNodes = useCallback(() => {
    updateSearchParams({ showBlankNodes: String(!showBlankNodes) })
  }, [showBlankNodes, updateSearchParams])

  const handleVisualize = useCallback(() => {
    if (!uri) return
    router.push(`/graphs-visualizations?uri=${encodeURIComponent(uri)}`)
  }, [uri, router])

  const getFilenameBase = useCallback((resourceUri: string, label?: string) => {
    const fallbackFromUri = resourceUri
      .substring(resourceUri.lastIndexOf('/') + 1)
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()

    const computed =
      label?.replace(/[^a-z0-9]/gi, '_').toLowerCase() ||
      fallbackFromUri ||
      'resource'

    const sanitized = computed.replace(/_+/g, '_').replace(/^_+|_+$/g, '')
    return sanitized || 'resource'
  }, [])

  const handleDownload = useCallback(
    (fileType: FileType) => {
      if (!uri) return

      try {
        const params = new URLSearchParams({
          uri,
          format: fileType.contentType,
          filename: getFilenameBase(uri, resourceInfo?.label),
          role,
          showBlankNodes: String(showBlankNodes)
        })

        const form = document.createElement('form')
        form.method = 'POST'
        form.action = `/api/export/resource?${params.toString()}`
        form.target = '_blank'
        form.style.display = 'none'

        document.body.appendChild(form)
        form.submit()
        document.body.removeChild(form)

        toast.success(`Export started for ${fileType.name}`)
      } catch (e) {
        console.error('Download failed:', e)
        toast.error('Download failed', {
          description: e instanceof Error ? e.message : undefined
        })
      }
    },
    [uri, role, showBlankNodes, resourceInfo?.label, getFilenameBase]
  )

  // --- Render Logic ---

  if (!uri && status === 'idle') {
    return (
      <div className="text-muted-foreground container mx-auto p-6">
        Please provide a resource URI in the URL (e.g., ?uri=...).
      </div>
    )
  }

  const showInitialSkeleton =
    status === 'idle' || (status === 'loading' && !resourceInfo)

  return (
    <div className="space-y-4">
      {/* Error Display */}
      {status === 'error' && error && (
        <Card className="border-destructive bg-destructive/10 mb-4">
          <CardContent className="text-destructive pt-4 text-sm">
            <p className="font-medium">Query error:</p>
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Initial Loading Skeleton */}
      {showInitialSkeleton && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      )}

      {/* Content Area */}
      {resourceInfo ? <ResourceHeader resourceInfo={resourceInfo} /> : null}

      <Separator />
      <div className="flex items-center gap-x-4 gap-y-2 justify-between flex-wrap">
        <Tabs
          value={role}
          onValueChange={(v) => handleRoleChange(v as ResourceRole)}
          className="flex-1"
        >
          <TabsList className="h-10 w-full">
            {RESOURCE_ROLES.map((roleOption) => (
              <TabsTrigger
                key={roleOption}
                value={roleOption}
                data-testid={`role-${roleOption}`}
                className="capitalize"
              >
                {roleOption}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Button
            variant={showBlankNodes ? 'secondary' : 'outline'}
            size="sm"
            onClick={handleToggleBlankNodes}
            aria-label="Toggle blank nodes visibility"
          >
            <BracketsIcon />
            Blank Nodes: {showBlankNodes ? 'Shown' : 'Hidden'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <DownloadIcon /> Download As
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {fileTypes.map((fileType) => (
                <DropdownMenuItem
                  key={fileType.name}
                  onClick={() => handleDownload(fileType)}
                >
                  {fileType.name} ({fileType.contentType})
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={handleVisualize}>
            <ExternalLinkIcon /> Visual Graph
          </Button>
        </div>
      </div>

      {/* Triples Data Table */}
      <TriplesDataTable
        triples={triples}
        status={triplesStatus}
        error={triplesError}
        resourceInfo={resourceInfo}
      />
    </div>
  )
}
