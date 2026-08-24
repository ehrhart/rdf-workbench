import { NextResponse } from 'next/server'
import { getWorkbenchRuntime } from '@/lib/runtime'

export async function GET() {
  await (await getWorkbenchRuntime()).auth.logout()

  return NextResponse.redirect('/')
}
