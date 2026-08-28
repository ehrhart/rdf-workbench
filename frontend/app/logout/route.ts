import { NextResponse } from 'next/server'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { getRuntimeConfig } from '@/lib/runtime/config'

export async function GET(request: Request) {
  await (await getWorkbenchRuntime()).auth.logout()

  // Get redirect parameter
  const url = new URL(request.url)
  const requestedRedirect = url.searchParams.get('redirect')
  const redirect =
    requestedRedirect?.startsWith('/') && !requestedRedirect.startsWith('//')
      ? requestedRedirect
      : null

  // Redirect to login with redirect parameter if provided
  const loginUrl = new URL('/login', getRuntimeConfig().WORKBENCH_URL)
  if (redirect) {
    loginUrl.searchParams.set('redirect', redirect)
  }
  return NextResponse.redirect(loginUrl)
}
