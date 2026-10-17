import { NextResponse } from 'next/server'
import { getAppearanceAsset } from '@/lib/appearance/appearance-settings'

export async function GET() {
  const asset = await getAppearanceAsset('logo')
  if (!asset) {
    return NextResponse.json({ error: 'Logo not found' }, { status: 404 })
  }

  const headers: Record<string, string> = {
    'Content-Type': asset.mime,
    'Cache-Control': 'public, max-age=31536000, immutable'
  }
  if (asset.mime === 'image/svg+xml') {
    // SVG can carry scripts; this header keeps the response inert even if
    // upload validation misses one.
    headers['Content-Security-Policy'] = 'script-src none; sandbox'
  }

  return new Response(Buffer.from(asset.data, 'base64'), { headers })
}
