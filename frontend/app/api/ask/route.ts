import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage
} from 'ai'
import { type NextRequest, NextResponse } from 'next/server'
import { getAiSettings } from '@/lib/ai/ai-settings'
import type { AskMessageMetadata } from '@/lib/ai/ask-contract'
import { createAskTools } from '@/lib/ai/ask-tools'
import { getAiConfig } from '@/lib/ai/config'
import { loadOrBuildProfile, withLivePrefixes } from '@/lib/ai/profile-store'
import { buildSystemPrompt } from '@/lib/ai/prompt'
import { renderProfileText } from '@/lib/ai/render'
import { requireAskPrincipal } from '@/lib/api-auth'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { computeFeatures } from '@/lib/runtime/features'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'

export async function POST(request: NextRequest) {
  const startedAt = Date.now()

  if (!isSameOriginMutation(request)) return sameOriginError()

  const runtime = await getWorkbenchRuntime()
  if (!computeFeatures(runtime.provider, process.env).has('ai-ask')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const auth = await requireAskPrincipal()
  if (auth.response) return auth.response

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

  const payload = (await request.json().catch(() => null)) as
    | { messages?: UIMessage[] }
    | UIMessage[]
    | null
  const uiMessages = Array.isArray(payload)
    ? payload
    : (payload?.messages ?? null)
  if (!uiMessages || !Array.isArray(uiMessages) || uiMessages.length === 0) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
  }

  const [profile, settings] = await Promise.all([
    loadOrBuildProfile().then((loaded) => withLivePrefixes(loaded)),
    getAiSettings()
  ])
  const profileText = profile ? renderProfileText(profile) : null
  const system = buildSystemPrompt({
    profile,
    profileText,
    provider: runtime.provider,
    customInstruction: settings.customInstruction,
    graphKnowledge: settings.graphKnowledge
  })

  const provider = createOpenAICompatible({
    name: 'rdf-workbench-ask',
    baseURL: aiConfig.AI_BASE_URL,
    apiKey: aiConfig.AI_API_KEY
  })

  let stepCount = 0
  const result = streamText({
    model: provider(aiConfig.AI_MODEL),
    system,
    messages: await convertToModelMessages(uiMessages),
    tools: createAskTools(runtime, profile),
    stopWhen: stepCountIs(aiConfig.AI_MAX_STEPS),
    onError: ({ error }) => {
      console.error('[ask] stream error:', error)
    }
  })

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type === 'start-step') {
        stepCount += 1
        return undefined
      }
      if (part.type === 'finish') {
        const metadata: AskMessageMetadata = {
          durationMs: Date.now() - startedAt,
          stepCount,
          budgetReached: stepCount >= aiConfig.AI_MAX_STEPS,
          usage: {
            inputTokens: part.totalUsage?.inputTokens,
            outputTokens: part.totalUsage?.outputTokens
          }
        }
        return metadata
      }
      return undefined
    }
  })
}
