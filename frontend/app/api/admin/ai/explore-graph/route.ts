import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateText, stepCountIs } from 'ai'
import { type NextRequest, NextResponse } from 'next/server'
import { getAiSettings } from '@/lib/ai/ai-settings'
import { createAskTools } from '@/lib/ai/ask-tools'
import { getAiConfig } from '@/lib/ai/config'
import { DIALECT_NOTES } from '@/lib/ai/dialect'
import { loadOrBuildProfile, withLivePrefixes } from '@/lib/ai/profile-store'
import { buildPrefixBlock } from '@/lib/ai/prompt'
import { renderProfileText } from '@/lib/ai/render'
import { requirePrincipal } from '@/lib/api-auth'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { computeFeatures } from '@/lib/runtime/features'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'

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

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return sameOriginError()

  const runtime = await getWorkbenchRuntime()
  if (!computeFeatures(runtime.provider, process.env).has('ai-ask')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const auth = await requirePrincipal()
  if (auth.response) return auth.response

  if (auth.principal.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only administrators can explore the graph' },
      { status: 403 }
    )
  }

  const aiConfig = getAiConfig()
  if (!aiConfig) {
    return NextResponse.json(
      {
        error:
          'AI is not configured. Set AI_BASE_URL, AI_API_KEY, and AI_MODEL to enable the ask assistant.'
      },
      { status: 503 }
    )
  }

  try {
    const [profile, settings] = await Promise.all([
      loadOrBuildProfile().then((loaded) => withLivePrefixes(loaded)),
      getAiSettings()
    ])

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
      tools: createAskTools(runtime, profile),
      stopWhen: stepCountIs(Math.max(aiConfig.AI_MAX_STEPS + 8, 24))
    })

    const knowledge = result.text.trim()
    if (!knowledge) {
      return NextResponse.json(
        { error: 'The AI produced no summary — try again.' },
        { status: 502 }
      )
    }
    return NextResponse.json({ knowledge })
  } catch (error) {
    console.error('[ask] graph exploration failed:', error)
    return NextResponse.json(
      {
        error: 'Graph exploration failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
