import { type NextRequest, NextResponse } from 'next/server'
import { getAiConfig } from '@/lib/ai/config'
import {
  JobAlreadyRunningError,
  startExploreJob
} from '@/lib/ai/exploration-jobs'
import { requirePrincipal } from '@/lib/api-auth'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { computeFeatures } from '@/lib/runtime/features'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'

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
      { error: 'Only administrators can generate the summary' },
      { status: 403 }
    )
  }

  const aiConfig = getAiConfig()
  if (!aiConfig) {
    return NextResponse.json(
      {
        error:
          'AI is not configured. Set AI_BASE_URL, AI_API_KEY, and AI_MODEL to enable the Ask assistant.'
      },
      { status: 503 }
    )
  }

  try {
    const job = await startExploreJob()
    return NextResponse.json({ job }, { status: 202 })
  } catch (error) {
    if (error instanceof JobAlreadyRunningError) {
      return NextResponse.json(
        { error: error.message, job: error.job },
        { status: 409 }
      )
    }
    console.error('[ask] failed to start the exploration job:', error)
    return NextResponse.json(
      { error: "Couldn't generate the summary." },
      { status: 500 }
    )
  }
}
