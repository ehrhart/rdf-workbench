import { NextResponse } from 'next/server'
import { getWorkbenchRuntime } from '@/lib/runtime'

export async function GET(request: Request) {
  await (await getWorkbenchRuntime()).auth.logout()

  return NextResponse.redirect(new URL('/', request.url))
}
