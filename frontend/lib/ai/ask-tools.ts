import 'server-only'

import { tool } from 'ai'
import { z } from 'zod'
import type {
  RunQueryOutput,
  SearchEntitiesOutput
} from '@/lib/ai/ask-contract'
import { getAiConfig } from '@/lib/ai/config'
import type { DatasetProfile } from '@/lib/ai/dataset-profile'
import { shrinkIri } from '@/lib/ai/render'
import { validateSparqlQuery } from '@/lib/ai/validate'
import type { WorkbenchRuntime } from '@/lib/runtime/contracts'
import type { SparqlBindingValue } from '@/types'

export interface AskToolOutputs {
  search_entities: SearchEntitiesOutput
  run_readonly_query: RunQueryOutput
}

export type AskTools = {
  search_entities: ReturnType<typeof createSearchEntitiesTool>
  run_readonly_query: ReturnType<typeof createRunQueryTool>
}

const MAX_TOOL_ROWS = 25
const MAX_DISPLAY_ROWS = 25
const MAX_CELL_CHARS = 300

const HTML_TAG_PATTERN = /<[^>]*>/g
const HTML_ENTITY_PATTERN = /&(?:amp|lt|gt|quot|#39);/g
const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'"
}

function sanitizeExcerpt(excerpt: string): string {
  return excerpt
    .replace(HTML_TAG_PATTERN, ' ')
    .replace(HTML_ENTITY_PATTERN, (entity) => HTML_ENTITIES[entity] ?? entity)
    .replace(/\s+/g, ' ')
    .trim()
}

function bindingToDisplay(
  value: SparqlBindingValue,
  prefixes: Record<string, string>
): string {
  if (value.type === 'uri') return shrinkIri(value.value, prefixes)
  if (value.type === 'bnode') return '_:bnode'
  return value.value.slice(0, MAX_CELL_CHARS)
}

function createSearchEntitiesTool(runtime: WorkbenchRuntime) {
  return tool({
    description:
      'Search resources in the triplestore by text term. Returns resource IRIs with a text excerpt. Use it to resolve any named entity from the question to an IRI before querying.',
    inputSchema: z.object({
      term: z
        .string()
        .min(2)
        .describe('Text to search for, e.g. a person, place, or concept name')
    }),
    execute: async ({ term }: { term: string }) => {
      try {
        const suggestions =
          await runtime.textSearch.getResourceSuggestions(term)
        return {
          results: suggestions.slice(0, 8).map((suggestion) => ({
            resource: suggestion.resource,
            label: sanitizeExcerpt(suggestion.excerpt)
          })),
          note:
            suggestions.length === 0
              ? 'No resources matched. Try a shorter or different term.'
              : undefined
        }
      } catch (error) {
        return {
          results: [],
          note: `Entity search failed: ${
            error instanceof Error ? error.message : 'unknown error'
          }. Query label properties directly instead.`
        }
      }
    }
  })
}

function createRunQueryTool(
  runtime: WorkbenchRuntime,
  profile: DatasetProfile | null
) {
  return tool({
    description:
      'Validate and execute a read-only SPARQL SELECT or ASK query against the triplestore. Returns query results (up to 25 rows) or validation issues explaining what to fix.',
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe('The SPARQL SELECT or ASK query to run'),
      purpose: z
        .string()
        .optional()
        .describe('One short line about what this query checks')
    }),
    execute: async ({ query }: { query: string }) => {
      const aiConfig = getAiConfig()
      const resultLimit = aiConfig?.AI_RESULT_LIMIT ?? 1000
      const timeoutMs = aiConfig?.AI_QUERY_TIMEOUT_MS ?? 30_000

      const validation = validateSparqlQuery(query, profile, {
        resultLimit,
        checkVocabulary: (profile?.classes.length ?? 0) > 0
      })
      if (!validation.ok || !validation.query) {
        return {
          ok: false as const,
          query,
          issues: validation.issues
        }
      }

      const startedAt = performance.now()
      try {
        const result = await runtime.sparql.execute(validation.query, {
          timeoutMs
        })
        const durationMs = Math.round(performance.now() - startedAt)
        if (result.kind === 'boolean') {
          return {
            ok: true as const,
            kind: 'boolean' as const,
            query: validation.query,
            boolean: result.value,
            durationMs
          }
        }
        if (result.kind === 'graph') {
          return {
            ok: false as const,
            query: validation.query,
            issues: [
              'CONSTRUCT/DESCRIBE results are not supported by this tool. Rewrite as SELECT.'
            ]
          }
        }

        const prefixes = profile?.prefixes ?? {}
        const links: Record<string, string> = {}
        const rows = result.bindings.slice(0, MAX_TOOL_ROWS).map((binding) => {
          const display: Record<string, string> = {}
          for (const [key, value] of Object.entries(binding)) {
            display[key] = bindingToDisplay(value, prefixes)
            if (value.type === 'uri') links[display[key]] = value.value
          }
          return display
        })
        return {
          ok: true as const,
          kind: 'bindings' as const,
          query: validation.query,
          variables: result.variables,
          rows,
          rowCount: result.bindings.length,
          truncated: result.bindings.length > MAX_DISPLAY_ROWS,
          durationMs,
          limitEnforced: validation.limitEnforced,
          links
        }
      } catch (error) {
        return {
          ok: false as const,
          query: validation.query,
          error:
            error instanceof Error ? error.message : 'Query execution failed'
        }
      }
    }
  })
}

export function createAskTools(
  runtime: WorkbenchRuntime,
  profile: DatasetProfile | null
): AskTools {
  return {
    search_entities: createSearchEntitiesTool(runtime),
    run_readonly_query: createRunQueryTool(runtime, profile)
  }
}
