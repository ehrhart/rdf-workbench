import { type NextRequest, NextResponse } from 'next/server'
import type { AiJobKind } from '@/lib/ai/ask-contract'
import { cancelJob, latestJobs } from '@/lib/ai/exploration-jobs'
import { requirePrincipal } from '@/lib/api-auth'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { computeFeatures } from '@/lib/runtime/features'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'

const KINDS: readonly AiJobKind[] = ['explore', 'profile']

function parseKind(value: string | null): AiJobKind | null {
  return KINDS.find((kind) => kind === value) ?? null
}

async function guard(): Promise<NextResponse | null> {
  const runtime = await getWorkbenchRuntime()
  if (!computeFeatures(runtime.provider, process.env).has('ai-ask')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const auth = await requirePrincipal()
  if (auth.response) return auth.response

  if (auth.principal.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only administrators can manage AI jobs' },
      { status: 403 }
    )
  }
  return null
}

export async function GET() {
  const denied = await guard()
  if (denied) return denied

  return NextResponse.json(await latestJobs())
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginMutation(request)) return sameOriginError()

  const denied = await guard()
  if (denied) return denied

  const kind = parseKind(request.nextUrl.searchParams.get('kind'))
  if (!kind) {
    return NextResponse.json({ error: 'Unknown job kind' }, { status: 400 })
  }

  await cancelJob(kind)
  return new NextResponse(null, { status: 204 })
}
