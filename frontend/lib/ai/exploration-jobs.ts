import 'server-only'

import crypto from 'node:crypto'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateText, stepCountIs } from 'ai'
import { after } from 'next/server'
import { getAiSettings, updateGraphKnowledge } from '@/lib/ai/ai-settings'
import type { AiJobDto, AiJobKind, AiJobStatus } from '@/lib/ai/ask-contract'
import { createAskTools } from '@/lib/ai/ask-tools'
import { getAiConfig } from '@/lib/ai/config'
import { buildDatasetProfile } from '@/lib/ai/dataset-profile'
import { DIALECT_NOTES } from '@/lib/ai/dialect'
import {
  loadOrBuildProfile,
  storeProfile,
  withLivePrefixes
} from '@/lib/ai/profile-store'
import { buildPrefixBlock } from '@/lib/ai/prompt'
import { renderProfileText } from '@/lib/ai/render'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { getWorkbenchDatabase } from '@/lib/workbench-database'

const EXPLORER_ROLE = `You are analyzing the RDF dataset behind a SPARQL endpoint to write durable notes that will be injected into the system prompt of a future question-answering assistant. Investigate the graph yourself using the search_entities and run_readonly_query tools — never speculate; only state what you verified with queries.

Explore:
- what the dataset describes (topics, sources)
- the main entity types and how they relate (include 1-2 example IRIs each)
- predicate usage conventions
- literal formats (dates, language tags, datatypes)
- scale (counts)
- anything surprising or non-obvious you verified
- query patterns that work well on this data
- pitfalls (properties that look useful but are empty, duplicated data, odd modeling)

Be concise and concrete: markdown, at most ~600 words, no preamble, output ONLY the notes themselves.

You have a limited number of tool steps. Spend most of them investigating, but ALWAYS finish by writing the notes — never end your turn without producing them.`

interface AiJobRow {
  id: string
  kind: string
  status: string
  started_at: string
  finished_at: string | null
  steps_done: number
  error: string | null
  knowledge: string | null
  model: string
}

interface JobHandle {
  kind: AiJobKind
  cancelController: AbortController
  deadlineId: NodeJS.Timeout
}

/**
 * Live jobs keyed by id. On globalThis so Turbopack HMR in dev does not
 * orphan a running job's cancel handle.
 */
const registry = globalThis as typeof globalThis & {
  __aiJobHandles?: Map<string, JobHandle>
}
if (!registry.__aiJobHandles) registry.__aiJobHandles = new Map()
const handles: Map<string, JobHandle> = registry.__aiJobHandles

/** Thrown by startJob when that kind already has a live job. */
export class JobAlreadyRunningError extends Error {
  readonly job: AiJobDto
  constructor(job: AiJobDto) {
    super(`The ${job.kind} job is already running`)
    this.job = job
  }
}

function toDto(row: AiJobRow): AiJobDto {
  return {
    id: row.id,
    kind: row.kind as AiJobKind,
    status: row.status as AiJobStatus,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    stepsDone: row.steps_done,
    error: row.error,
    knowledge: row.knowledge,
    model: row.model
  }
}

function liveJob(
  kind: AiJobKind
): { id: string; handle: JobHandle } | undefined {
  for (const [id, handle] of handles) {
    if (handle.kind === kind) return { id, handle }
  }
  return undefined
}

async function getJobRow(id: string): Promise<AiJobRow | undefined> {
  const db = await getWorkbenchDatabase()
  return db.prepare('SELECT * FROM ai_jobs WHERE id = ?').get(id) as
    | AiJobRow
    | undefined
}

async function finalizeJob(
  id: string,
  status: Extract<AiJobStatus, 'succeeded' | 'failed' | 'cancelled'>,
  patch: { error?: string; knowledge?: string } = {}
): Promise<void> {
  const db = await getWorkbenchDatabase()
  db.prepare(
    'UPDATE ai_jobs SET status = ?, finished_at = ?, error = ?, knowledge = COALESCE(?, knowledge) WHERE id = ?'
  ).run(
    status,
    new Date().toISOString(),
    patch.error ?? null,
    patch.knowledge ?? null,
    id
  )
}

type JobExec = (
  signal: AbortSignal,
  onStep: () => void
) => Promise<{ knowledge?: string }>

async function startJob(
  kind: AiJobKind,
  model: string,
  deadlineMs: number,
  exec: JobExec
): Promise<AiJobDto> {
  const db = await getWorkbenchDatabase()

  const live = liveJob(kind)
  if (live) {
    const row = await getJobRow(live.id)
    if (row && row.status === 'running')
      throw new JobAlreadyRunningError(toDto(row))
    handles.delete(live.id)
  }

  const runningRow = db
    .prepare("SELECT * FROM ai_jobs WHERE kind = ? AND status = 'running'")
    .get(kind) as AiJobRow | undefined
  if (runningRow) throw new JobAlreadyRunningError(toDto(runningRow))

  const id = crypto.randomUUID()
  db.prepare('DELETE FROM ai_jobs WHERE kind = ?').run(kind)
  db.prepare(
    "INSERT INTO ai_jobs (id, kind, status, started_at, model) VALUES (?, ?, 'running', ?, ?)"
  ).run(id, kind, new Date().toISOString(), model)

  const cancelController = new AbortController()
  const deadlineController = new AbortController()
  const deadlineId = setTimeout(
    () => deadlineController.abort('deadline'),
    deadlineMs
  )
  handles.set(id, { kind, cancelController, deadlineId })

  const signal = AbortSignal.any([
    cancelController.signal,
    deadlineController.signal
  ])
  let stepsDone = 0
  const onStep = (): void => {
    stepsDone += 1
    db.prepare('UPDATE ai_jobs SET steps_done = ? WHERE id = ?').run(
      stepsDone,
      id
    )
  }

  after(() => {
    ;(async () => {
      try {
        const result = await exec(signal, onStep)
        await finalizeJob(id, 'succeeded', { knowledge: result.knowledge })
      } catch (error) {
        if (cancelController.signal.aborted) {
          await finalizeJob(id, 'cancelled')
        } else if (deadlineController.signal.aborted) {
          await finalizeJob(id, 'failed', {
            error: `job timed out after ${Math.round(deadlineMs / 1000)}s`
          })
        } else {
          await finalizeJob(id, 'failed', {
            error: error instanceof Error ? error.message : String(error)
          })
        }
      } finally {
        clearTimeout(deadlineId)
        handles.delete(id)
      }
    })()
  })

  const row = await getJobRow(id)
  return toDto(row as AiJobRow)
}

/** Aborts the running job of that kind; false when none is running. */
export async function cancelJob(kind: AiJobKind): Promise<boolean> {
  const live = liveJob(kind)
  if (!live) return false
  live.handle.cancelController.abort('cancelled')
  return true
}

export interface LatestJobs {
  explore: AiJobDto | null
  profile: AiJobDto | null
}

export async function latestJobs(): Promise<LatestJobs> {
  const db = await getWorkbenchDatabase()
  const read = async (kind: AiJobKind): Promise<AiJobDto | null> => {
    const row = db
      .prepare(
        'SELECT * FROM ai_jobs WHERE kind = ? ORDER BY started_at DESC LIMIT 1'
      )
      .get(kind) as AiJobRow | undefined
    return row ? toDto(row) : null
  }
  const [explore, profile] = await Promise.all([
    read('explore'),
    read('profile')
  ])
  return { explore, profile }
}

async function runExplore(
  signal: AbortSignal,
  onStep: () => void
): Promise<{ knowledge: string }> {
  const runtime = await getWorkbenchRuntime()
  const aiConfig = getAiConfig()
  if (!aiConfig) throw new Error('AI is not configured')

  const [profile, settings] = await Promise.all([
    loadOrBuildProfile(signal).then((loaded) => withLivePrefixes(loaded)),
    getAiSettings()
  ])
  // loadOrBuildProfile swallows build errors into null; an aborted build
  // must stop the job rather than explore without a profile.
  if (signal.aborted) throw new Error('Exploration cancelled')

  const parts: string[] = [EXPLORER_ROLE]

  if (profile) {
    parts.push('')
    parts.push(
      'The dataset profile below is your starting map, not a substitute for exploring: verify anything you intend to write down with your own queries.'
    )
    parts.push('<dataset_profile>')
    parts.push(renderProfileText(profile))
    parts.push('</dataset_profile>')
  }

  const prefixBlock = buildPrefixBlock(profile?.prefixes ?? {})
  if (prefixBlock) {
    parts.push('')
    parts.push('Declared prefixes:')
    parts.push(prefixBlock)
  }

  parts.push('')
  parts.push(DIALECT_NOTES[runtime.provider])

  const priorKnowledge = settings.graphKnowledge.trim()
  if (priorKnowledge) {
    parts.push('')
    parts.push(
      'Notes from a previous exploration are below. Re-verify what still holds, drop what is stale, and improve them with what you find; output the complete updated notes.'
    )
    parts.push('<previous_notes>')
    parts.push(priorKnowledge)
    parts.push('</previous_notes>')
  }

  const provider = createOpenAICompatible({
    name: 'rdf-workbench-explore',
    baseURL: aiConfig.AI_BASE_URL,
    apiKey: aiConfig.AI_API_KEY
  })

  const result = await generateText({
    model: provider(aiConfig.AI_MODEL),
    system: parts.join('\n'),
    prompt: 'Explore the dataset now and write the notes.',
    tools: createAskTools(runtime, profile, signal),
    stopWhen: stepCountIs(Math.max(aiConfig.AI_MAX_STEPS + 8, 24)),
    abortSignal: signal,
    onStepFinish: onStep
  })

  const knowledge = result.text.trim()
  if (!knowledge) throw new Error('The AI produced no summary')
  await updateGraphKnowledge(knowledge)
  return { knowledge }
}

async function runProfile(signal: AbortSignal): Promise<void> {
  const profile = await buildDatasetProfile(signal)
  await storeProfile(profile)
}

export async function startExploreJob(): Promise<AiJobDto> {
  const aiConfig = getAiConfig()
  if (!aiConfig) throw new Error('AI is not configured')
  return startJob(
    'explore',
    aiConfig.AI_MODEL,
    aiConfig.AI_JOB_TIMEOUT_MS,
    (signal, onStep) => runExplore(signal, onStep)
  )
}

export async function startProfileJob(): Promise<AiJobDto> {
  const aiConfig = getAiConfig()
  if (!aiConfig) throw new Error('AI is not configured')
  return startJob(
    'profile',
    aiConfig.AI_MODEL,
    aiConfig.AI_JOB_TIMEOUT_MS,
    async (signal) => {
      await runProfile(signal)
      return {}
    }
  )
}
