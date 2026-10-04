import { type NextRequest, NextResponse } from 'next/server'
import { getAiSettings } from '@/lib/ai/ai-settings'
import type { DatasetProfile } from '@/lib/ai/dataset-profile'
import {
  getProfileSummary,
  loadStoredProfile,
  rebuildProfile,
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

export async function POST(_request: NextRequest) {
  if (!isSameOriginMutation(_request)) return sameOriginError()

  const runtime = await getWorkbenchRuntime()
  if (!computeFeatures(runtime.provider, process.env).has('ai-ask')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const auth = await requirePrincipal()
  if (auth.response) return auth.response

  if (auth.principal.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only administrators can rebuild the dataset profile' },
      { status: 403 }
    )
  }

  try {
    const profile = await rebuildProfile()
    return NextResponse.json({
      profile: {
        builtAt: profile.builtAt,
        provider: profile.provider,
        endpoint: profile.endpoint,
        classCount: profile.classes.length,
        propertyCount: profile.classes.reduce(
          (total, cls) => total + cls.properties.length,
          0
        ),
        tripleCount: profile.tripleCount
      }
    })
  } catch (error) {
    console.error('[ask] profile rebuild failed:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to build the dataset profile'
      },
      { status: 500 }
    )
  }
}
