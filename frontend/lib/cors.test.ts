import { NextResponse } from 'next/server'
import { describe, expect, it } from 'vitest'
import { applyCorsHeaders, corsAllowOrigin, getCorsConfig } from './cors'

function withEnv(
  values: Record<string, string | undefined>,
  run: () => void
): void {
  const previous: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    run()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

describe('getCorsConfig', () => {
  it('defaults to enabled with every origin allowed', () => {
    withEnv(
      { CORS_ENABLED: undefined, CORS_ALLOWED_ORIGINS: undefined },
      () => {
        expect(getCorsConfig()).toEqual({
          enabled: true,
          allowedOrigins: '*',
          exposeHeaders: []
        })
      }
    )
  })

  it('turns off on 0 or false and on for anything else', () => {
    withEnv({ CORS_ENABLED: 'false' }, () =>
      expect(getCorsConfig().enabled).toBe(false)
    )
    withEnv({ CORS_ENABLED: '0' }, () =>
      expect(getCorsConfig().enabled).toBe(false)
    )
    withEnv({ CORS_ENABLED: 'nonsense' }, () =>
      expect(getCorsConfig().enabled).toBe(true)
    )
  })

  it('parses a comma-separated origin list and treats * as allow-all', () => {
    withEnv(
      { CORS_ALLOWED_ORIGINS: 'https://a.example, https://b.example' },
      () => {
        expect(getCorsConfig().allowedOrigins).toEqual([
          'https://a.example',
          'https://b.example'
        ])
      }
    )
    withEnv({ CORS_ALLOWED_ORIGINS: 'https://a.example, *' }, () => {
      expect(getCorsConfig().allowedOrigins).toBe('*')
    })
  })

  it('parses the expose-headers list', () => {
    withEnv({ CORS_EXPOSE_HEADERS: 'Content-Disposition, ETag' }, () => {
      expect(getCorsConfig().exposeHeaders).toEqual([
        'Content-Disposition',
        'ETag'
      ])
    })
  })
})

describe('corsAllowOrigin', () => {
  const list = {
    enabled: true,
    allowedOrigins: ['https://a.example'] as const,
    exposeHeaders: []
  }

  it('allows every origin in wildcard mode', () => {
    expect(
      corsAllowOrigin('https://x.example', { ...list, allowedOrigins: '*' })
    ).toBe('*')
    expect(corsAllowOrigin(null, { ...list, allowedOrigins: '*' })).toBe('*')
  })

  it('echoes exact matches from a list', () => {
    expect(corsAllowOrigin('https://a.example', list)).toBe('https://a.example')
  })

  it('denies non-matching and missing origins in list mode', () => {
    expect(corsAllowOrigin('https://evil.example', list)).toBeNull()
    expect(corsAllowOrigin(null, list)).toBeNull()
  })
})

describe('applyCorsHeaders', () => {
  it('stamps the full set in wildcard mode without Vary', () => {
    const response = NextResponse.json({})
    applyCorsHeaders(response, '*', {
      enabled: true,
      allowedOrigins: '*',
      exposeHeaders: []
    })
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('access-control-allow-methods')).toBe(
      'GET, HEAD, POST, OPTIONS'
    )
    expect(response.headers.get('access-control-allow-headers')).toBe(
      'Accept, Authorization, Content-Type'
    )
    expect(response.headers.get('access-control-max-age')).toBe('86400')
    expect(response.headers.get('vary')).toBeNull()
  })

  it('exposes configured headers and varies by origin in list mode', () => {
    const response = NextResponse.json({})
    response.headers.append('Vary', 'Accept-Encoding')
    applyCorsHeaders(response, 'https://a.example', {
      enabled: true,
      allowedOrigins: ['https://a.example'],
      exposeHeaders: ['Content-Disposition']
    })
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://a.example'
    )
    expect(response.headers.get('access-control-expose-headers')).toBe(
      'Content-Disposition'
    )
    expect(response.headers.get('vary')).toBe('Accept-Encoding, Origin')
  })
})
