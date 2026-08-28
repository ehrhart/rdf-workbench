'use client'

import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getRunningQueries } from '@/app/(dashboard)/monitor/queries/actions'
import { Badge } from '@/components/ui/badge'

export function QueryActivity() {
  const [count, setCount] = useState<number>(0)
  const [, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (cancelled) return
      setLoading(true)
      try {
        const data = await getRunningQueries()
        if (cancelled) return
        setCount(data.length)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(
          err instanceof Error ? err.message : 'Failed to load running queries'
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    const intervalId = setInterval(load, 1000)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [])

  if (error || count === 0) return null

  return (
    <Badge asChild variant="secondary" className="text-foreground shadow-sm">
      <Link href="/monitor/queries" className="flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/50" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-semibold tracking-tight">
          {count === 1 ? '1 query running' : `${count} queries running`}
        </span>
        <Loader2 className="h-3.5 w-3.5 text-primary/90 transition-transform animate-spin" />
      </Link>
    </Badge>
  )
}
