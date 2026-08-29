'use server'

import { getWorkbenchRuntime } from '@/lib/runtime'
import type { NamedGraph, ResourceSuggestion, SparqlQueryResult } from '@/types'

export async function executeQuery(query: string): Promise<SparqlQueryResult> {
  return (await getWorkbenchRuntime()).sparql.execute(query)
}

export async function getNamedGraphs(): Promise<NamedGraph[]> {
  return (await getWorkbenchRuntime()).graphs.listNamedGraphs()
}

export async function getPrefixes(): Promise<Record<string, string>> {
  return (await getWorkbenchRuntime()).prefixes.list()
}

export async function getResourceSuggestions(
  searchTerm: string
): Promise<ResourceSuggestion[]> {
  return (await getWorkbenchRuntime()).textSearch.getResourceSuggestions(
    searchTerm
  )
}

export async function getProperties(): Promise<string[]> {
  const result = await executeQuery(`
    SELECT DISTINCT ?property
    WHERE { ?subject ?property ?object }
    ORDER BY ?property
    LIMIT 1000
  `)
  if (result.kind !== 'bindings') return []
  return result.bindings
    .map((binding) => binding.property?.value ?? '')
    .filter(Boolean)
}

export async function getClasses(): Promise<string[]> {
  const result = await executeQuery(`
    SELECT DISTINCT ?class
    WHERE { ?subject a ?class }
    ORDER BY ?class
    LIMIT 1000
  `)
  if (result.kind !== 'bindings') return []
  return result.bindings
    .map((binding) => binding.class?.value ?? '')
    .filter(Boolean)
}
