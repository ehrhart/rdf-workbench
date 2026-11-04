import { useCallback, useEffect, useRef, useState } from 'react'
import { executeQuery } from '@/lib/triplestore'
import type { AppStatus, ResourceInfo, ResourceRole, Triple } from './types'
import { generateTriplesQuery, parseTripleResults } from './utils'

type ResourceMetaBinding = {
  type?: { value?: string }
  label?: { value?: string }
  comment?: { value?: string }
}

export function useResourceData(
  uri: string | null,
  role: ResourceRole,
  showBlankNodes: boolean
) {
  const [status, setStatus] = useState<AppStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [resourceInfo, setResourceInfo] = useState<ResourceInfo | null>(null)

  const [triplesStatus, setTriplesStatus] = useState<AppStatus>('idle')
  const [triplesError, setTriplesError] = useState<string | null>(null)
  const [triples, setTriples] = useState<Triple[]>([])

  // Track ongoing requests to prevent race conditions
  const metadataAbortControllerRef = useRef<AbortController | null>(null)
  const triplesAbortControllerRef = useRef<AbortController | null>(null)

  const fetchResourceMetadata = useCallback(
    async (resourceUri: string, resourceRole: ResourceRole) => {
      if (!resourceUri) {
        setStatus('idle')
        setError('No URI provided.')
        setResourceInfo(null)
        return
      }

      metadataAbortControllerRef.current?.abort()
      metadataAbortControllerRef.current = new AbortController()

      setStatus('loading')
      setError(null)

      if (/[<>]/.test(resourceUri)) {
        setStatus('error')
        setError('The resource URI contains characters that are not allowed')
        return
      }

      try {
        const metaQuery = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        SELECT DISTINCT ?label ?comment ?type WHERE {
          OPTIONAL { <${resourceUri}> rdfs:label ?label }
          OPTIONAL { <${resourceUri}> rdfs:comment ?comment }
          OPTIONAL { <${resourceUri}> a ?type }
        } LIMIT 50`

        const metaResults = await executeQuery(metaQuery)
        const bindings =
          metaResults.kind === 'bindings'
            ? (metaResults.bindings as ResourceMetaBinding[])
            : []

        const types = [
          ...new Set(bindings.map((b) => b.type?.value).filter(Boolean))
        ] as string[]

        const firstLabel = bindings.find((b) => b.label)?.label?.value
        const firstComment = bindings.find((b) => b.comment)?.comment?.value

        setResourceInfo({
          uri: resourceUri,
          role: resourceRole,
          showBlankNodes,
          label: firstLabel,
          comment: firstComment,
          type: types
        })
        setStatus('success')
      } catch (err) {
        console.error('Error fetching resource metadata:', err)
        const errorMessage =
          err instanceof Error ? err.message : 'An unknown error occurred'
        setError(errorMessage)
        setStatus('error')
        setResourceInfo(null)
      }
    },
    [showBlankNodes]
  )

  const fetchTriples = useCallback(
    async (
      resourceUri: string,
      resourceRole: ResourceRole,
      includeBlankNodes: boolean
    ) => {
      if (!resourceUri) {
        setTriplesStatus('idle')
        setTriplesError('No URI provided.')
        setTriples([])
        return
      }

      triplesAbortControllerRef.current?.abort()
      triplesAbortControllerRef.current = new AbortController()

      setTriplesStatus('loading')
      setTriplesError(null)

      try {
        const triplesQuery = generateTriplesQuery(
          resourceUri,
          resourceRole,
          includeBlankNodes
        )

        const triplesResult = await executeQuery(triplesQuery)
        const fetchedTriples = parseTripleResults(
          triplesResult.kind === 'bindings' ? triplesResult.bindings : []
        )

        setTriples(fetchedTriples)
        setTriplesStatus('success')
      } catch (err) {
        console.error('Error fetching triples:', err)
        const errorMessage =
          err instanceof Error ? err.message : 'An unknown error occurred'
        setTriplesError(errorMessage)
        setTriplesStatus('error')
        setTriples([])
      }
    },
    []
  )

  useEffect(() => {
    if (uri) {
      void fetchResourceMetadata(uri, role)
    } else {
      setStatus('idle')
      setResourceInfo(null)
      setError('No URI parameter specified.')
    }

    return () => {
      metadataAbortControllerRef.current?.abort()
    }
  }, [uri, fetchResourceMetadata, role])

  /**
   * Update resourceInfo role and showBlankNodes when they change
   * without refetching metadata
   */
  useEffect(() => {
    setResourceInfo((prev) => {
      if (!prev) return null
      if (prev.role === role && prev.showBlankNodes === showBlankNodes)
        return prev
      return { ...prev, role, showBlankNodes }
    })
  }, [role, showBlankNodes])

  useEffect(() => {
    if (uri && resourceInfo) {
      void fetchTriples(uri, role, showBlankNodes)
    }

    return () => {
      triplesAbortControllerRef.current?.abort()
    }
  }, [uri, role, showBlankNodes, resourceInfo, fetchTriples])

  return {
    status,
    error,
    resourceInfo,

    triplesStatus,
    triplesError,
    triples
  }
}
