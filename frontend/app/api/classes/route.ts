import { NextResponse } from 'next/server'
import { getClasses } from '@/lib/triplestore'

export async function GET() {
  try {
    const classes = await getClasses()
    return NextResponse.json(classes)
  } catch (error) {
    console.error('Error fetching classes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch classes' },
      { status: 500 }
    )
  }
}
