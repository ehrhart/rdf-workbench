import { type NextRequest, NextResponse } from 'next/server'
import { getAiSettings } from '@/lib/ai/ai-settings'
import { getAiConfig } from '@/lib/ai/config'
import type { DatasetProfile } from '@/lib/ai/dataset-profile'
import {
  JobAlreadyRunningError,
  startProfileJob
} from '@/lib/ai/exploration-jobs'
import {
  getProfileSummary,
  loadStoredProfile,
  withLivePrefixes
} from '@/lib/ai/profile-store'
import { buildSystemPrompt } from '@/lib/ai/prompt'
import { renderProfileText } from '@/lib/ai/render'
import { requireAskPrincipal, requirePrincipal } from '@/lib/api-auth'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { computeFeatures } from '@/lib/runtime/features'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'

export async function GET(request: NextRequest) {
  const runtime = await getWorkbenchRuntime()
  if (!computeFeatures(runtime.provider, process.env).has('ai-ask')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const auth = await requireAskPrincipal()
  if (auth.response) return auth.response

  const summary = await getProfileSummary().catch(() => null)
  const wantsFull = request.nextUrl.searchParams.get('full') === '1'

  let profile: DatasetProfile | null = null
  try {
    profile = await withLivePrefixes(await loadStoredProfile())
  } catch (error) {
    console.error('[ask] failed to load stored profile:', error)
  }
  const settings = await getAiSettings()

  if (!wantsFull || !summary) {
    return NextResponse.json({ profile: summary })
  }

  try {
    const profileText = profile ? renderProfileText(profile) : null
    return NextResponse.json({
      profile: summary,
      text: profileText,
      systemPrompt: buildSystemPrompt({
        profile,
        profileText,
        provider: runtime.provider,
        customInstruction: settings.customInstruction,
        graphKnowledge: settings.graphKnowledge
      })
    })
  } catch (error) {
    console.error('[ask] failed to render stored profile:', error)
    return NextResponse.json({
      profile: summary,
      text: null
    })
  }
}

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
      { error: 'Only admins can rebuild the dataset profile.' },
      { status: 403 }
    )
  }

  const aiConfig = getAiConfig()
  if (!aiConfig) {
    return NextResponse.json(
      {
        error:
          "Ask isn't set up on this instance yet. An admin needs to connect an AI provider."
      },
      { status: 503 }
    )
  }

  try {
    const job = await startProfileJob()
    return NextResponse.json({ job }, { status: 202 })
  } catch (error) {
    if (error instanceof JobAlreadyRunningError) {
      return NextResponse.json(
        { error: error.message, job: error.job },
        { status: 409 }
      )
    }
    console.error('[ask] failed to start the profile job:', error)
    return NextResponse.json(
      { error: "Couldn't start the profile build. Try again." },
      { status: 500 }
    )
  }
}
