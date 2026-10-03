/**
 * Client-facing DTOs for the ask feature. Shared between the server tools,
 * the API routes, and the chat UI so none of them need to import
 * server-only modules.
 */

export interface SearchEntitiesOutput {
  results: Array<{ resource: string; label: string }>
  note?: string
}

export interface QuerySuccessOutput {
  ok: true
  kind: 'bindings' | 'boolean'
  query: string
  variables?: string[]
  /** Display-ready rows, IRIs already shortened. */
  rows?: Array<Record<string, string>>
  rowCount?: number
  truncated?: boolean
  boolean?: boolean
  /** Wall time of the triplestore round trip in milliseconds. */
  durationMs?: number
  /** True when validation capped the query's LIMIT to the configured maximum. */
  limitEnforced?: boolean
  /** Display string → original full URI for URI-typed cells. */
  links?: Record<string, string>
}

export interface QueryFailureOutput {
  ok: false
  query: string
  error?: string
  issues?: string[]
}

export type RunQueryOutput = QuerySuccessOutput | QueryFailureOutput

export interface ProfileSummaryDto {
  builtAt: string
  provider: string
  endpoint: string
  classCount: number
  propertyCount: number
  tripleCount: number | null
}

export interface ProfileResponseDto {
  profile: ProfileSummaryDto | null
  text?: string
  systemPrompt?: string
  exampleQuestions?: string[]
}

/** Metadata attached to the streamed assistant message. */
export interface AskMessageMetadata {
  durationMs?: number
  stepCount?: number
  budgetReached?: boolean
  usage?: { inputTokens?: number; outputTokens?: number }
}

export interface ConversationDto {
  id: string
  title: string
  ownerId: string
  createdAt: string
  updatedAt: string
  messageCount: number
}
