import { NextResponse } from 'next/server'
import { getWorkbenchRuntime } from '@/lib/runtime'

export async function GET() {
  try {
    const prefixes = await (await getWorkbenchRuntime()).prefixes.list()
    return NextResponse.json(prefixes)
  } catch (error) {
    console.error('Error fetching prefixes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prefixes' },
      { status: 500 }
    )
  }
}
