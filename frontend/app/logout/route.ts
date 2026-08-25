import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { getWorkbenchRuntime } from '@/lib/runtime'

function safeRedirect(requested: string | null): string | null {
  return requested?.startsWith('/') && !requested.startsWith('//')
    ? requested
    : null
}

export async function GET(request: NextRequest) {
  await (await getWorkbenchRuntime()).auth.logout()

  const requested = safeRedirect(request.nextUrl.searchParams.get('redirect'))
  redirect(
    requested ? `/login?redirect=${encodeURIComponent(requested)}` : '/'
  )
}
